"""Offline Gemini compatibility and safe admin-readiness diagnostics."""

import pytest

from app.services.assistant import provider


def test_google_uses_json_mode_and_low_reasoning(settings):
    config = settings.model_copy(
        update={
            "assistant_api_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "assistant_model": "gemini-3.8-flash",
        }
    )
    result = provider.payload("fictional question", [], config)
    assert result["response_format"] == {"type": "json_object"}
    assert result["reasoning_effort"] == "low"
    assert result["max_tokens"] == 256


def test_flash_25_can_disable_reasoning(settings):
    config = settings.model_copy(
        update={
            "assistant_api_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "assistant_model": "gemini-2.5-flash",
        }
    )
    assert provider.payload("fictional", [], config)["reasoning_effort"] == "none"


def test_other_providers_keep_the_existing_protocol(settings):
    config = settings.model_copy(
        update={"assistant_api_url": "https://provider.invalid/chat/completions"}
    )
    result = provider.payload("fictional", [], config)
    assert "reasoning_effort" not in result and "response_format" not in result


def test_readiness_explains_gates_without_key_values(settings):
    config = settings.model_copy(
        update={"assistant_provider": "chat_completions", "assistant_allow_live": False}
    )
    reasons = provider.issues(config)
    assert reasons == [
        "live_access_disabled",
        "api_key_missing",
        "api_url_missing",
        "model_missing",
    ]
    assert provider.issues(settings.model_copy(update={"assistant_provider": "disabled"})) == [
        "provider_disabled"
    ]


@pytest.mark.parametrize("model", ["gemma-4-26b-a4b-it", "gemma-4-31b-it"])
def test_google_gemma_uses_minimal_thinking_and_keeps_context(settings, model):
    config = settings.model_copy(
        update={
            "assistant_api_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "assistant_model": model,
        }
    )
    result = provider.payload(
        "fictional greeting", [], config, [{"role": "user", "content": "earlier fictional message"}]
    )
    assert result["reasoning_effort"] == "minimal"
    assert result["response_format"] == {"type": "json_object"}
    assert result["messages"][0]["role"] == "system"
    assert "No relevant knowledge found" in result["messages"][1]["content"]
    assert result["messages"][-1]["content"] == "fictional greeting"
    assert result["messages"][2]["content"] == "earlier fictional message"
    assert result["temperature"] == 0.25
    assert result["max_tokens"] == config.assistant_max_output_tokens


def test_gemma_on_other_host_does_not_receive_google_options(settings):
    config = settings.model_copy(
        update={
            "assistant_api_url": "https://fictional.invalid/chat/completions",
            "assistant_model": "gemma-4-26b-a4b-it",
        }
    )
    result = provider.payload("fictional", [], config)
    assert "reasoning_effort" not in result
    assert "response_format" not in result
