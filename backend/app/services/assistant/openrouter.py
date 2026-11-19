"""Free-only, bounded model failover; no customer content in diagnostics."""

import json
import logging
import time

import httpx

from app.services.assistant import provider

STRUCTURED_MODELS = {"inclusionai/ling-3.2-flash:free", "particle-ai/particle-1:free"}
ANSWER_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["conversation", "grounded", "unsupported"]},
        "answer": {"type": "string"},
        "source_id": {"type": ["string", "null"]},
        "quote": {"type": ["string", "null"]},
    },
    "required": ["kind", "answer", "source_id", "quote"],
    "additionalProperties": False,
}


def parse_answer(text):
    """Normalize an exact JSON fence only; never extract arbitrary prose or arrays."""
    text = text.strip()
    if text.startswith("```json\n") and text.endswith("\n```"):
        text = text[8:-4]
    value = json.loads(text)
    if not isinstance(value, dict) or set(value) != set(ANSWER_SCHEMA["required"]):
        raise ValueError("Unexpected reply fields")
    if value["kind"] not in {"conversation", "grounded", "unsupported"}:
        raise ValueError("Unknown answer kind")
    if not isinstance(value["answer"], str) or not 1 <= len(value["answer"].strip()) <= 900:
        raise ValueError("Invalid answer")
    if value["kind"] == "grounded":
        if not isinstance(value["source_id"], str) or not isinstance(value["quote"], str):
            raise ValueError("Unexpected reply fields")
        if not 20 <= len(value["quote"]) <= 500:
            raise ValueError("Unexpected reply fields")
    elif value["source_id"] is not None or value["quote"] is not None:
        raise ValueError("Unexpected conversational citation")
    return json.dumps(value, ensure_ascii=False)


class OpenRouter:
    def __init__(self, before_fallback=None):
        self.before_fallback = before_fallback

    def complete(self, payload, settings):
        models = [
            settings.assistant_model,
            *[m.strip() for m in settings.assistant_fallback_models.split(",") if m.strip()],
        ]
        deadline = time.monotonic() + 25
        total_in = total_out = 0
        all_known = True
        last_error = None
        for index, model in enumerate(models):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            if index and self.before_fallback is not None and not self.before_fallback():
                break
            body = {**payload, "model": model}
            body.pop("reasoning_effort", None)
            body["reasoning"] = {"enabled": False}
            body["provider"] = {
                "allow_fallbacks": False,
                "data_collection": "deny",
                "max_price": {"prompt": 0, "completion": 0},
            }
            if model in STRUCTURED_MODELS:
                body["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "kofa_answer", "strict": True, "schema": ANSWER_SCHEMA},
                }
                body["provider"]["require_parameters"] = True
            # Distinct secret avoids forwarding the old Google key to a new provider.
            config = settings.model_copy(update={"assistant_api_key": settings.openrouter_api_key})
            result = None
            try:
                result = provider.ChatCompletions(time_budget=min(8, remaining)).complete(
                    body, config
                )
                total_in += result.tokens_in
                total_out += result.tokens_out
                all_known = all_known and result.usage_known
                text = parse_answer(result.text)
                return provider.Reply(text, model, total_in, total_out, all_known)
            except (ValueError, httpx.HTTPError) as exc:
                if result is None:
                    all_known = False
                kind, status = provider.failure_details(exc)
                logging.getLogger("kofa").warning(
                    "assistant_fallback attempt=%s kind=%s status=%s", index + 1, kind, status
                )
                last_error = exc
                # Invalid key/account/configuration cannot be repaired by changing models.
                if isinstance(exc, httpx.HTTPStatusError) and status not in {
                    404,
                    408,
                    429,
                    500,
                    502,
                    503,
                    504,
                }:
                    raise
        if last_error is not None:
            raise last_error
        raise ValueError("Provider response limit")
