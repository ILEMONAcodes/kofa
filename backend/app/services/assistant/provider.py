"""Server-only, bounded, no-retry chat-completions adapter and test-only simulator."""

import json
import time
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit

import httpx

from app.services.assistant.prompts import SYSTEM


@dataclass
class Reply:
    text: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    usage_known: bool = False


class Provider(Protocol):
    def complete(self, payload: dict, settings) -> Reply: ...


DAILY_TOKEN_BUDGET = 10000


def token_limit(settings):
    return min(DAILY_TOKEN_BUDGET, settings.assistant_hard_token_limit)


def ready(settings):
    return (
        settings.assistant_provider == "test"
        and settings.app_env == "test"
        or (
            settings.assistant_provider == "chat_completions"
            and settings.assistant_allow_live
            and bool(settings.assistant_api_key.get_secret_value())
            and bool(settings.assistant_api_url)
            and bool(settings.assistant_model)
        )
    )


def payload(question, sources, settings, history=None):
    sources = [
        {
            **source,
            "filename": source.get(
                "filename", source.get("type", "public") + "/" + str(source.get("id", "source"))
            ),
        }
        for source in sources
    ]
    result = {
        "model": settings.assistant_model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": "KNOWLEDGE CONTEXT:\n"
                + (
                    json.dumps({"public_sources": sources}, ensure_ascii=False)
                    if sources
                    else "No relevant knowledge found"
                ),
            },
            *(history or []),
            {"role": "user", "content": question},
        ],
        "max_tokens": settings.assistant_max_output_tokens,
        "temperature": 0.25,
        "stream": False,
    }
    if urlsplit(settings.assistant_api_url).hostname == "generativelanguage.googleapis.com":
        result["response_format"] = {"type": "json_object"}
        result["reasoning_effort"] = (
            "none"
            if settings.assistant_model.startswith("gemini-2.5")
            and "flash" in settings.assistant_model
            else "low"
        )
    return result


def issues(settings):
    if settings.assistant_provider == "disabled":
        return ["provider_disabled"]
    if settings.assistant_provider == "test":
        return [] if settings.app_env == "test" else ["provider_disabled"]
    result = []
    if not settings.assistant_allow_live:
        result.append("live_access_disabled")
    if not settings.assistant_api_key.get_secret_value():
        result.append("api_key_missing")
    if not settings.assistant_api_url:
        result.append("api_url_missing")
    if not settings.assistant_model:
        result.append("model_missing")
    return result


class Simulated:
    def complete(self, payload, settings):
        assert settings.app_env == "test"
        context = payload["messages"][1]["content"].partition("\n")[2]
        sources = (
            json.loads(context)["public_sources"]
            if context != "No relevant knowledge found"
            else []
        )
        if sources:
            source = sources[0]
            quote = source["text"][:450]
            result = json.dumps(
                {"kind": "grounded", "answer": quote, "source_id": source["key"], "quote": quote}
            )
        else:
            result = json.dumps(
                {
                    "kind": "unsupported",
                    "answer": "I’m not sure; please contact support.",
                    "source_id": None,
                    "quote": None,
                }
            )
        return Reply(
            result, "test-extractive", len(json.dumps(payload).encode()), len(result.encode()), True
        )


class ChatCompletions:
    def complete(self, payload, settings):
        started = time.monotonic()
        # No retries/redirects/proxy inheritance: each reservation permits one request.
        with httpx.Client(
            timeout=httpx.Timeout(20, connect=5), follow_redirects=False, trust_env=False
        ) as client:
            with client.stream(
                "POST",
                settings.assistant_api_url,
                headers={
                    "Authorization": "Bearer " + settings.assistant_api_key.get_secret_value()
                },
                json=payload,
            ) as response:
                content = bytearray()
                for part in response.iter_bytes():
                    content.extend(part)
                    if len(content) > 65536 or time.monotonic() - started > 25:
                        raise ValueError("Provider response limit")
                if response.is_error:
                    httpx.Response(
                        response.status_code, content=bytes(content), request=response.request
                    ).raise_for_status()
        data = json.loads(content)
        text = data["choices"][0]["message"]["content"]
        if not isinstance(text, str) or len(text) > 4000:
            raise ValueError("Invalid provider response")
        usage = data.get("usage", {})
        known = all(
            type(usage.get(key)) is int and 0 <= usage[key] <= 10000000
            for key in ["prompt_tokens", "completion_tokens"]
        )
        return Reply(
            text,
            settings.assistant_model,
            usage["prompt_tokens"] if known else 0,
            usage["completion_tokens"] if known else 0,
            known,
        )


def build(settings):
    return (
        Simulated()
        if settings.assistant_provider == "test" and settings.app_env == "test"
        else ChatCompletions()
    )
