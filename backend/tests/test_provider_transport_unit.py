"""No database/network: provider timeout and no-retry regression checks."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from pydantic import SecretStr

from app.services.assistant import provider


class TransportTests(unittest.TestCase):
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
