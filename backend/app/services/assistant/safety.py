"""Deterministic input/source/output boundaries; model output is never trusted."""

import re

EMAIL = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
NUMBERS = re.compile(r"(?<!\w)\+?\d(?:[\d\s(),.-]*\d)?(?!\w)")
INJECTION = re.compile(
    r"ignore.{0,35}(?:instructions|previous|rules)|system\s*(?:prompt|message)|developer\s*message|(?:reveal|print|show).{0,30}(?:secret|api.?key|password|prompt)|jailbreak|execute\s+(?:sql|code)|<\s*(?:script|iframe)|(?:override|forget).{0,25}(?:rules|instructions)",
    re.I,
)
PRIVATE = re.compile(
    r"exact\s+(?:street\s+)?address|landlord.{0,20}(?:phone|contact|email)|(?:ownership|identity)\s+(?:file|document)|internal\s+(?:note|record)|other\s+(?:user|client)|database|passport|national\s+id",
    re.I,
)
STOP = {
    "a",
    "an",
    "the",
    "i",
    "we",
    "you",
    "my",
    "our",
    "your",
    "me",
    "to",
    "for",
    "in",
    "on",
    "of",
    "and",
    "or",
    "is",
    "are",
    "be",
    "can",
    "do",
    "does",
    "how",
    "what",
    "where",
    "when",
    "please",
    "tell",
    "about",
    "with",
    "would",
    "like",
    "want",
    "need",
    "some",
    "show",
    "find",
    "looking",
}


def digits(value):
    return re.sub(r"\D", "", value)


def redact(value):
    value = EMAIL.sub("[email removed]", value)
    return NUMBERS.sub(
        lambda m: "[number removed]" if len(digits(m.group())) >= 9 else m.group(), value
    )


def reason(value):
    if INJECTION.search(value) or PRIVATE.search(value):
        return "out_of_scope"
    if re.search(
        r"\b(suicid\w*|self.?harm|danger|unsafe|threat\w*|violence|emergency)\b", value, re.I
    ):
        return "sensitive_topic"
    if re.search(
        r"\b(human|person|agent|staff|representative)\b|speak.{0,15}(team|someone)|call me",
        value,
        re.I,
    ):
        return "user_requested"
    if re.search(
        r"\b(pay\w*|refund\w*|fee\w*|commission\w*|bank\w*|legal\w*|lawyer\w*|title\w*|dispute\w*|complain\w*|fraud\w*|scam\w*|negotiat\w*|discount\w*)\b|my\s+(account|inquiry|appointment|inspection|transaction)|\b(password|sign.?in|log.?in)\b",
        value,
        re.I,
    ):
        return "out_of_scope"
    return None


def tokens(value):
    result = {word for word in re.findall(r"[a-z]{3,}", value.lower()) if word not in STOP}
    aliases = {
        "verified": "verification",
        "verify": "verification",
        "checks": "verification",
        "inspections": "inspection",
        "visit": "inspection",
        "visits": "inspection",
        "listing": "property",
        "properties": "property",
        "apartments": "apartment",
        "flats": "apartment",
        "flat": "apartment",
    }
    return {aliases.get(word, word) for word in result}


def safe_output(value, support):
    if INJECTION.search(value) or PRIVATE.search(value):
        return False
    if re.search(
        r"\b(?:guarantee\w*|prove[sd]?)\b.{0,50}\b(?:ownership|title)\b|\b(?:pay|transfer|deposit)\b.{0,40}\b(?:account|bank|money)\b",
        value,
        re.I,
    ):
        return False
    allowed_email = (support.email or "").lower()
    if any(email.lower() != allowed_email for email in EMAIL.findall(value)):
        return False
    allowed_phone = digits(support.phone or "")
    for match in NUMBERS.finditer(value):
        if len(digits(match.group())) < 9 or digits(match.group()) == allowed_phone:
            continue
        prefix = value[max(0, match.start() - 6) : match.start()]
        # Explicitly formatted public prices are numbers, not contact details.
        if re.search(r"(?:NGN|₦)\s*$", prefix) and re.fullmatch(
            r"\d{1,3}(?:,\d{3})+(?:\.\d{2})?", match.group().strip()
        ):
            continue
        return False
    if re.search(r"\b\d+\s+\w+(?:\s+\w+){0,3}\s+(?:street|road|avenue|close)\b", value, re.I):
        return False
    return True
