"""Assistant orchestration. Models only see the redacted question and public sources."""

import hashlib
import hmac
import json
import re
import secrets
import time
import uuid

from sqlalchemy import func, select

from app.core.errors import AppError
from app.core.security import now
from app.models.assistant import AssistantFeedback, AssistantMessage, AssistantUsage, Conversation
from app.models.identity import AuditLog, User
from app.models.inquiry import Inquiry, InquiryHistory, InquiryMessage, InquiryNote
from app.repositories import assistant as repo
from app.repositories import knowledge as knowledge_repo
from app.schemas import assistant as s
from app.services import knowledge
from app.services.assistant import provider, safety
from app.services.assistant.retrieval import retrieve
from app.services.media import current_staff
from app.services.rate_limit import consume


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def identity(settings, ip):
    return hmac.new(
        settings.auth_secret.get_secret_value().encode(), ip.encode(), hashlib.sha256
    ).hexdigest()


def support(db, settings):
    return knowledge.public_config(db, settings).support


def handoff(reason, contact, report=False):
    message = (
        "Our team can help with this. Please use the support line or send a message to the team."
    )
    if reason == "sensitive_topic":
        message = "If you are in immediate danger, contact local emergency services. For help with Kof’a, contact our team using the support details below."
    options = [
        s.Option(
            type="call",
            phone=contact.phone,
            display_phone=contact.display_phone,
            hours_text=contact.hours_text,
            is_open_now=contact.is_open_now,
        ),
        s.Option(type="message_team", requires_login=True),
    ]
    if report:
        options.append(s.Option(type="report_listing", url="/report"))
    return s.Handoff(reason=reason, message=message, options=options)


def get(db, id, actor, token, lock=False, claim_anonymous=False):
    row = repo.owned(db, id, actor.id if actor else None, digest(token) if token else None, lock)
    if row is None and actor and token and claim_anonymous:
        row = repo.owned(db, id, None, digest(token), lock)
    if row is None:
        raise AppError(
            404, "NOT_FOUND", "Conversation not found or expired. Start a new conversation."
        )
    return row


def start(db, settings, actor, ip):
    consume(
        db,
        settings,
        "assistant.start",
        str(actor.id) if actor else identity(settings, ip),
        20 if actor else 5,
        86400,
    )
    token = None if actor else secrets.token_urlsafe(32)
    row = Conversation(
        user_id=actor.id if actor else None,
        anon_token_hash=digest(token) if token else None,
        ip_hash=identity(settings, ip),
    )
    db.add(row)
    db.commit()
    config = knowledge.public_config(db, settings)
    return s.Start(
        id=row.id,
        token=token,
        greeting="How can I help with your home search?",
        disclosure=config.assistant.disclosure,
        support=config.support,
    )


def message_out(row):
    return s.Message(
        id=row.id,
        role=row.role,
        content=row.content,
        created_at=row.created_at,
        sources=row.sources,
    )


def history(db, settings, id, actor, token):
    row = get(db, id, actor, token, claim_anonymous=True)
    return s.History(
        id=row.id,
        status=row.status,
        messages=[message_out(m) for m in repo.messages(db, id)],
        handoff=handoff(row.handoff_reason, support(db, settings)) if row.handoff_reason else None,
        inquiry_id=row.inquiry_id,
    )


def turn(db, settings, id, actor, token, ip, content, adapter=None):
    row = get(db, id, actor, token, claim_anonymous=True)
    consume(
        db,
        settings,
        "assistant.messages",
        str(actor.id) if actor else identity(settings, ip),
        60 if actor else 20,
        3600,
    )
    if row.inquiry_id or row.status == "closed":
        raise AppError(
            409, "CONFLICT", "This conversation has moved to your inquiry. Continue there."
        )
    lease = uuid.uuid4()
    if not repo.claim(db, id, lease):
        raise AppError(409, "CONFLICT", "A reply is already being prepared. Please wait.")
    started = time.monotonic()
    received_at = now()
    try:
        db.expire_all()
        row = db.get(Conversation, id)
        turn_limit = len(repo.messages(db, id)) >= 40
        if turn_limit:
            reason = "service_unavailable"
        else:
            reason = safety.reason(content)
        question = safety.redact(content)
        if not reason and row.failures >= 2:
            reason = "repeated_failure"
        contact = support(db, settings)
        config = knowledge.values(knowledge_repo.settings(db))
        limit = min(config.assistant_daily_token_budget, settings.assistant_hard_token_limit)
        sources = []
        reply = None
        chosen = None
        text = ""
        intent = "help"
        day = None
        if not reason and (
            not config.assistant_enabled
            or not provider.ready(settings)
            or not contact.phone
            or limit <= 0
        ):
            reason = "service_unavailable"
        if not reason:
            sources = retrieve(db, question, contact)
            if not sources:
                reason = "low_confidence"
        if not reason:
            payload = provider.payload(question, sources, settings)
            amount = (
                len(json.dumps(payload, ensure_ascii=False).encode())
                + settings.assistant_max_output_tokens
                + 512
            )
            if amount > 16000:
                reason = "service_unavailable"
            else:
                day = repo.reserve(db, amount, limit, settings.assistant_daily_request_limit)
                if not day:
                    reason = "service_unavailable"
            if not reason:
                try:
                    reply = (adapter or provider.build(settings)).complete(payload, settings)
                    selection = json.loads(reply.text)
                    if not isinstance(selection, dict) or set(selection) - {"source_id", "quote"}:
                        raise ValueError("Unexpected selection")
                    chosen = next(
                        (
                            source
                            for source in sources
                            if source["key"] == selection.get("source_id")
                        ),
                        None,
                    )
                    quote = selection.get("quote")
                    if (
                        not chosen
                        or not isinstance(quote, str)
                        or not 20 <= len(quote) <= 500
                        or quote not in chosen["text"]
                    ):
                        reason = "low_confidence"
                    elif not safety.safe_output(quote, contact):
                        reason = "out_of_scope"
                    else:
                        # Publication/visibility is rechecked after the network call.
                        db.expire_all()
                        fresh = retrieve(db, question, contact)
                        current = next(
                            (source for source in fresh if source["key"] == chosen["key"]), None
                        )
                        if not current or quote not in current["text"]:
                            reason = "low_confidence"
                        else:
                            text = quote
                            chosen = current
                except Exception:
                    # No provider exception/body/URL/key enters logs or client responses.
                    reason = "service_unavailable"
                finally:
                    repo.account(db, day, reply, limit, amount)
        db.expire_all()
        row = db.scalar(
            select(Conversation)
            .where(Conversation.id == id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if row.in_flight != lease:
            raise AppError(409, "CONFLICT", "The reply expired. Please try again.")
        report = bool(re.search(r"fraud|scam", content, re.I))
        hand = handoff(reason, contact, report) if reason else None
        intent = reason or (
            "property_search" if chosen and chosen["type"] == "property" else "knowledge"
        )
        if hand:
            text = hand.message
        if reason in {"out_of_scope", "sensitive_topic"}:
            row.flagged = True
        row.failures = (
            row.failures + 1 if reason in {"low_confidence", "repeated_failure"} else row.failures
        )
        row.status = "closed" if turn_limit else "handed_off" if hand else "active"
        row.handoff_reason = reason
        row.handed_off_at = now() if hand else None
        row.row_version += 1
        db.add(
            AssistantMessage(
                conversation_id=id,
                role="user",
                content=question,
                sources=[],
                intent=intent,
                created_at=received_at,
            )
        )
        output = AssistantMessage(
            conversation_id=id,
            role="assistant",
            created_at=now(),
            content=text,
            sources=[{k: chosen[k] for k in ["type", "id", "title", "url"]}]
            if chosen and not hand
            else [],
            intent=intent,
            handoff_reason=reason,
            model=reply.model if reply else "none",
            tokens_in=reply.tokens_in if reply else 0,
            tokens_out=reply.tokens_out if reply else 0,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        db.add(output)
        row.in_flight = None
        row.lease_until = None
        db.commit()
        return s.Turn(message=message_out(output), handoff=hand)
    finally:
        db.rollback()
        repo.release(db, id, lease)


def to_team(db, settings, id, actor, token, summary):
    if actor.role != "client":
        raise AppError(403, "FORBIDDEN", "Use a client account to message the team.")
    consume(db, settings, "inquiry-create", str(actor.id), 20, 86400)
    row = get(db, id, actor, token, True, True)
    if row.inquiry_id:
        return s.HandoffReceipt(inquiry_id=row.inquiry_id)
    if row.in_flight and row.lease_until > now():
        raise AppError(
            409, "CONFLICT", "Wait for the current reply before sending this conversation."
        )
    db.scalar(select(User).where(User.id == actor.id).with_for_update())
    body = safety.redact((summary or "").strip() or "Please help me with my property search.")
    inquiry = Inquiry(
        client_id=actor.id,
        kind="general",
        source="assistant",
        status="new",
        last_client_message_at=now(),
    )
    db.add(inquiry)
    db.flush()
    db.add(
        InquiryMessage(inquiry_id=inquiry.id, sender_id=actor.id, sender_role="client", body=body)
    )
    db.add(
        InquiryHistory(
            inquiry_id=inquiry.id, from_status=None, to_status="new", actor_user_id=actor.id
        )
    )
    transcript = "Assistant conversation (redacted):\n" + "\n\n".join(
        m.role + ": " + m.content for m in repo.messages(db, id)
    )
    for start in range(0, len(transcript), 3900):
        db.add(
            InquiryNote(
                inquiry_id=inquiry.id, author_id=actor.id, body=transcript[start : start + 3900]
            )
        )
    row.user_id = actor.id
    row.anon_token_hash = None
    row.inquiry_id = inquiry.id
    row.status = "handed_off"
    row.handoff_reason = "user_requested"
    row.handed_off_at = now()
    row.row_version += 1
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="assistant.handoff",
            entity_type="assistant_conversation",
            entity_id=row.id,
            after={"inquiry_id": str(inquiry.id)},
        )
    )
    db.commit()
    return s.HandoffReceipt(inquiry_id=inquiry.id)


def feedback(db, settings, id, actor, token, data):
    message = db.get(AssistantMessage, id)
    if message is None or message.role != "assistant":
        raise AppError(404, "NOT_FOUND", "Message not found.")
    row = get(db, message.conversation_id, actor, token, True, True)
    previous = db.scalar(select(AssistantFeedback).where(AssistantFeedback.message_id == id))
    if previous:
        if previous.helpful != data.helpful:
            raise AppError(409, "CONFLICT", "Feedback was already recorded.")
        return s.FeedbackReceipt()
    db.add(
        AssistantFeedback(message_id=id, helpful=data.helpful, comment=safety.redact(data.comment))
    )
    if not data.helpful:
        row.failures += 1
        row.flagged = True
        row.row_version += 1
    else:
        row.failures = 0
        row.row_version += 1
    db.commit()
    return s.FeedbackReceipt()


def review_summary(row):
    return s.ReviewSummary(
        id=row.id,
        status=row.status,
        handoff_reason=row.handoff_reason,
        flagged=row.flagged,
        version=row.row_version,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def reviews(db, actor, page, size, flagged=None, reason=None, from_date=None, to_date=None):
    from app.services.report import period

    current_staff(db, actor.id)
    _, _, start_date, end_date = period(from_date, to_date)
    conditions = []
    if start_date is not None:
        conditions.extend(
            [Conversation.updated_at >= start_date, Conversation.updated_at < end_date]
        )
    if flagged is not None:
        conditions.append(Conversation.flagged == flagged)
    if reason:
        conditions.append(Conversation.handoff_reason == reason)
    total = db.scalar(select(func.count()).select_from(Conversation).where(*conditions)) or 0
    rows = db.scalars(
        select(Conversation)
        .where(*conditions)
        .order_by(Conversation.updated_at.desc(), Conversation.id)
        .offset((page - 1) * size)
        .limit(size)
    )
    return s.ReviewPage(
        data=[review_summary(row) for row in rows],
        meta={
            "page": page,
            "page_size": size,
            "total_items": total,
            "total_pages": (total + size - 1) // size,
        },
    )


def review(db, actor, id, data=None):
    current_staff(db, actor.id)
    row = (
        db.scalar(
            select(Conversation)
            .where(Conversation.id == id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if data
        else db.get(Conversation, id)
    )
    if row is None:
        raise AppError(404, "NOT_FOUND", "Conversation not found.")
    if data:
        if data.version != row.row_version:
            raise AppError(409, "VERSION_CONFLICT", "This conversation changed. Reload it.")
        row.flagged = data.flagged
        row.review_note = safety.redact(data.review_note)
        row.row_version += 1
        db.add(
            AuditLog(
                actor_user_id=actor.id,
                action="assistant.reviewed",
                entity_type="assistant_conversation",
                entity_id=row.id,
                after={"flagged": row.flagged, "version": row.row_version},
            )
        )
        db.commit()
    return s.ReviewDetail(
        **review_summary(row).model_dump(),
        messages=[message_out(m) for m in repo.messages(db, id)],
        review_note=row.review_note,
        inquiry_id=row.inquiry_id,
    )


def usage(db, settings, actor):
    if actor.role != "admin":
        raise AppError(403, "FORBIDDEN", "Only admins can view assistant usage.")
    config = knowledge.values(knowledge_repo.settings(db))
    day = repo.today()
    row = db.get(AssistantUsage, day)
    limit = min(config.assistant_daily_token_budget, settings.assistant_hard_token_limit)
    counts = {
        name: getattr(row, name) if row else 0
        for name in [
            "reserved_tokens",
            "requests",
            "tokens_in",
            "tokens_out",
            "unknown_usage_requests",
        ]
    }
    return s.Usage(
        day=day,
        enabled=knowledge.public_config(db, settings).assistant.enabled,
        provider_ready=bool(provider.ready(settings)),
        provider=settings.assistant_provider,
        model=settings.assistant_model,
        token_limit=limit,
        request_limit=settings.assistant_daily_request_limit,
        remaining_tokens=max(0, limit - counts["reserved_tokens"]),
        remaining_requests=max(0, settings.assistant_daily_request_limit - counts["requests"]),
        **counts,
    )
