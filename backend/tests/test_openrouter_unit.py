"""Offline failover checks: no real keys, database or generation calls."""

import json
import unittest
from unittest.mock import patch

import httpx
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.services.assistant import provider
from app.services.assistant.openrouter import OpenRouter, parse_answer

MODELS = [
    "inclusionai/ling-3.2-flash:free",
    "particle-ai/particle-1:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "cohere/north-mini-code:free",
]
ANSWER = json.dumps(
    {"kind": "conversation", "answer": "Hello! How can I help?", "source_id": None, "quote": None}
)


def settings(**changes):
    return Settings(
        _env_file=None,
        **{
            "database_url": "postgresql://fictional@localhost/test",
            "auth_secret": "fictional-secret-for-unit-tests-only",
            "assistant_provider": "openrouter",
            "assistant_model": MODELS[0],
            "assistant_fallback_models": ",".join(MODELS[1:]),
            "assistant_api_url": "https://openrouter.ai/api/v1/chat/completions",
            "openrouter_api_key": SecretStr("fictional-openrouter"),
            "assistant_api_key": SecretStr("fictional-google-do-not-send"),
            "assistant_allow_live": True,
            **changes,
        },
    )


class OpenRouterTests(unittest.TestCase):
    def test_fallback_stops_when_reservation_is_denied(self):
        reserve = unittest.mock.Mock(return_value=False)
        request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
        error = httpx.HTTPStatusError(
            "fictional", request=request, response=httpx.Response(503, request=request)
        )
        with patch.object(provider.ChatCompletions, "complete", side_effect=error) as call:
            with self.assertRaises(httpx.HTTPStatusError):
                OpenRouter(before_fallback=reserve).complete({}, settings())
        self.assertEqual(call.call_count, 1)
        reserve.assert_called_once()

    def test_first_success_does_not_reserve_backups(self):
        reserve = unittest.mock.Mock()
        with patch.object(
            provider.ChatCompletions,
            "complete",
            return_value=provider.Reply(ANSWER, "fictional", 10, 20, True),
        ):
            OpenRouter(before_fallback=reserve).complete({}, settings())
        reserve.assert_not_called()

    def test_daily_budget_is_configurable_and_capped(self):
        config = settings(assistant_daily_token_budget=5000000, assistant_hard_token_limit=5000000)
        self.assertEqual(provider.token_limit(config), 5000000)
        config.assistant_hard_token_limit = 1000
        self.assertEqual(provider.token_limit(config), 1000)

    def run_chain(self, responses):
        calls = []
        real_client = httpx.Client

        def handler(request):
            calls.append(json.loads(request.content))
            self.assertEqual(request.headers["Authorization"], "Bearer fictional-openrouter")
            status, text = responses[len(calls) - 1]
            if status != 200:
                return httpx.Response(status, json={"error": "fictional"})
            return httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": text}}],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 20},
                },
            )

        config = settings()
        with patch.object(
            provider.httpx,
            "Client",
            lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
        ):
            result = OpenRouter().complete(provider.payload("Hi", [], config), config)
        return calls, result

    def test_outage_then_invalid_answer_then_success(self):
        calls, result = self.run_chain([(503, ""), (200, "[]"), (200, ANSWER)])
        self.assertEqual([c["model"] for c in calls], MODELS[:3])
        self.assertEqual(result.model, MODELS[2])
        self.assertFalse(result.usage_known)
        self.assertEqual(result.tokens_in, 20)
        self.assertEqual(json.loads(result.text)["kind"], "conversation")
        for body in calls:
            self.assertEqual(body["provider"]["max_price"], {"prompt": 0, "completion": 0})
            self.assertFalse(body["provider"]["allow_fallbacks"])
            self.assertEqual(body["provider"]["data_collection"], "deny")
            self.assertFalse(body["reasoning"]["enabled"])
        self.assertEqual(calls[0]["response_format"]["type"], "json_schema")
        self.assertNotIn("response_format", calls[2])

    def test_success_stops_and_counts_usage(self):
        calls, result = self.run_chain([(200, ANSWER)])
        self.assertEqual(len(calls), 1)
        self.assertTrue(result.usage_known)

    def test_all_four_attempts_and_auth_stop(self):
        for responses, expected in [([(503, "")] * 4, 503), ([(401, "")], 401)]:
            with self.subTest(status=expected), self.assertRaises(httpx.HTTPStatusError) as error:
                self.run_chain(responses)
            self.assertEqual(error.exception.response.status_code, expected)

    def test_configuration_is_free_only_bounded_and_host_pinned(self):
        for change in [
            {"assistant_model": "respan/span-01-lite"},
            {"assistant_fallback_models": ",".join(MODELS)},
            {"assistant_api_url": "https://other.invalid/chat/completions"},
        ]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                settings(**change)
        self.assertEqual(provider.attempt_count(settings()), 4)
        self.assertTrue(provider.ready(settings()))
        self.assertFalse(provider.ready(settings(openrouter_api_key="")))

    def test_parser_keeps_strict_shape(self):
        self.assertEqual(parse_answer("```json\n" + ANSWER + "\n```"), parse_answer(ANSWER))
        for invalid in ["[]", "null", '"hello"', '{"answer":"hello"}', "before " + ANSWER]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                parse_answer(invalid)

    def test_deadline_prevents_more_attempts(self):
        with (
            patch("app.services.assistant.openrouter.time.monotonic", side_effect=[0, 26]),
            patch.object(provider.ChatCompletions, "complete") as call,
        ):
            with self.assertRaises(ValueError):
                OpenRouter().complete({}, settings())
        call.assert_not_called()
