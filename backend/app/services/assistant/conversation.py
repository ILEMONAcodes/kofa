"""Bound recent, redacted conversation data without greeting classification or canned replies."""

from app.services.assistant import safety


def recent_history(messages, support):
    history = []
    for message in messages[-6:]:
        if message.handoff_reason or message.role not in {"user", "assistant"}:
            continue
        content = safety.redact(message.content)[:500]
        if safety.safe_output(content, support) and not safety.reason(content):
            history.append({"role": message.role, "content": content})
    return history


def reveals_prompt(answer):
    from app.services.assistant.prompts import SYSTEM

    normalized = " ".join(answer.lower().split())
    words = SYSTEM.lower().split()
    return "knowledge context:" in normalized or any(
        " ".join(words[index : index + 12]) in normalized for index in range(len(words) - 11)
    )
