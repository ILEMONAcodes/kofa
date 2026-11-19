"""No database/network: provider timeout and no-retry regression checks."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from pydantic import SecretStr

from app.services.assistant import provider


class TransportTests(unittest.TestCase):
    def test_safe_failure_categories(self):
        cases = {
            "Invalid provider envelope": "invalid_envelope",
            "Invalid provider choices": "invalid_choices",
            "Invalid provider message": "invalid_message",
            "Invalid provider response": "invalid_content",
            "Provider response limit": "response_limit",
            "Invalid reply": "invalid_answer_object",
            "Unexpected reply fields": "invalid_answer_fields",
            "Invalid answer": "invalid_answer_text",
            "Unexpected conversational citation": "invalid_conversation_citation",
            "Unknown answer kind": "invalid_answer_kind",
            "secret-key private conversation": "invalid_response",
        }
        for message, expected in cases.items():
            with self.subTest(category=expected):
                self.assertEqual(provider.failure_details(ValueError(message)), (expected, None))
        self.assertEqual(
            provider.failure_details(json.JSONDecodeError("private", "secret", 0)),
            ("invalid_json", None),
        )

    def test_timeout_failure_is_not_retried(self):
        settings = SimpleNamespace(
            assistant_api_url="https://fictional.invalid/chat/completions",
            assistant_api_key=SecretStr("fictional"),
        )
        real_client = httpx.Client
        calls = []

        def factory(**kwargs):
            self.assertEqual(kwargs["timeout"].connect, 5)
            self.assertEqual(kwargs["timeout"].read, 20)
            self.assertFalse(kwargs["trust_env"])

            def handler(request):
                calls.append(request)
                raise httpx.ReadTimeout("fictional timeout", request=request)

            return real_client(transport=httpx.MockTransport(handler), **kwargs)

        with patch.object(provider.httpx, "Client", factory):
            with self.assertRaises(httpx.ReadTimeout):
                provider.ChatCompletions().complete({}, settings)
        self.assertEqual(len(calls), 1)

    def test_flash_lite_disables_thinking(self):
        settings = SimpleNamespace(
            assistant_api_url="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            assistant_model="gemini-2.5-flash-lite",
            assistant_max_output_tokens=256,
        )
        result = provider.payload("fictional", [], settings)
        self.assertEqual(result["reasoning_effort"], "none")
        self.assertEqual(result["response_format"], {"type": "json_object"})

    def test_validation_error_body_is_bounded_and_not_retried(self):
        settings = SimpleNamespace(
            assistant_api_url="https://fictional.invalid/chat/completions",
            assistant_api_key=SecretStr("fictional"),
        )
        real_client = httpx.Client
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(400, json={"error": {"status": "INVALID_ARGUMENT"}})

        with patch.object(
            provider.httpx,
            "Client",
            lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
        ):
            with self.assertRaises(httpx.HTTPStatusError) as error:
                provider.ChatCompletions().complete({}, settings)
        self.assertEqual(error.exception.response.json()["error"]["status"], "INVALID_ARGUMENT")
        self.assertEqual(len(calls), 1)

    def test_code_allowance_obeys_host_ceiling(self):
        self.assertEqual(
            provider.token_limit(SimpleNamespace(assistant_hard_token_limit=1000000)), 100000
        )
        self.assertEqual(provider.token_limit(SimpleNamespace(assistant_hard_token_limit=500)), 500)
        self.assertEqual(provider.token_limit(SimpleNamespace(assistant_hard_token_limit=0)), 0)

    def test_public_readiness_ignores_saved_admin_disable(self):
        from app.services import knowledge

        settings = SimpleNamespace(
            assistant_hard_token_limit=100000, assistant_provider="test", app_env="test"
        )
        with patch.object(knowledge.repo, "settings", return_value={}):
            self.assertTrue(knowledge.public_config(None, settings).assistant.enabled)
        settings.assistant_hard_token_limit = 0
        with patch.object(knowledge.repo, "settings", return_value={}):
            self.assertFalse(knowledge.public_config(None, settings).assistant.enabled)

    def test_malformed_provider_envelope_rejected_without_type_error(self):
        settings = SimpleNamespace(
            assistant_api_url="https://fictional.invalid/chat/completions",
            assistant_api_key=SecretStr("fictional"),
            assistant_model="gemma-4-26b-a4b-it",
        )
        real_client = httpx.Client
        for body in [[{"error": {"code": 503}}], {"choices": []}, {"choices": [{"message": None}]}]:
            with self.subTest(body=body):

                def handler(request, payload=body):
                    return httpx.Response(200, json=payload)

                client = real_client(transport=httpx.MockTransport(handler))
                with patch.object(provider.httpx, "Client", return_value=client):
                    with self.assertRaises(ValueError):
                        provider.ChatCompletions().complete({}, settings)
