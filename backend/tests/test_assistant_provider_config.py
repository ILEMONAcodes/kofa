"""Offline Gemini compatibility and safe admin-readiness diagnostics."""

from app.services.assistant import provider


def test_google_uses_json_mode_and_minimal_reasoning(settings):
    config = settings.model_copy(
        update={
            "assistant_api_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "assistant_model": "gemini-3.8-flash",
        }
    )
    result = provider.payload("fictional question", [], config)
    assert result["response_format"] == {"type": "json_object"}
    assert result["reasoning_effort"] == "minimal"
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
