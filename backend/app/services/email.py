import smtplib
import ssl
from email.message import EmailMessage

from app.core.security import now
from app.repositories.email import pending_messages


def send_outbox(db, settings):
    if settings.email_mode != "smtp" or not settings.smtp_host or not settings.smtp_from:
        raise ValueError("SMTP is not configured; messages remain safely in the outbox")
    rows = pending_messages(db)
    # Only invoked explicitly. Credentials and message links are never printed.
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_starttls:
            server.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password.get_secret_value())
        for row in rows:
            message = EmailMessage()
            message["From"] = settings.smtp_from
            message["To"] = row.to_email
            message["Subject"] = {
                "reset": "Reset your Kof’a password",
                "invitation": "Your Kof’a team invitation",
                "verification": "Verify your Kof’a email",
            }[row.template]
            message.set_content(
                f"Follow this single-use link within one hour:\n{row.payload['link']}\nIf you did not request this, ignore this email."
            )
            try:
                server.send_message(message)
                row.status, row.sent_at = "sent", now()
                row.payload = {}  # Discard delivered secret link.
            except smtplib.SMTPException:
                row.status, row.last_error = "failed", "Email delivery failed"
            row.attempts += 1
        db.commit()
    return len(rows)
