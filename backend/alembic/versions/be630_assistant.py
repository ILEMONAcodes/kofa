"""Scoped assistant workflows, transcript retention and aggregate usage."""

from alembic import op

revision = "be630_assistant"
down_revision = "be629_support"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE assistant_conversations (
        id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), anon_token_hash varchar(64) UNIQUE,
        ip_hash varchar(64) NOT NULL, status varchar(20) NOT NULL, handoff_reason varchar(30),
        handed_off_at timestamptz, inquiry_id uuid REFERENCES inquiries(id), flagged boolean NOT NULL,
        review_note text NOT NULL, row_version integer NOT NULL, failures integer NOT NULL,
        in_flight uuid, lease_until timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_assistant_owner CHECK (user_id IS NOT NULL OR anon_token_hash IS NOT NULL),
        CONSTRAINT ck_assistant_status CHECK (status IN ('active','handed_off','closed')))""")
    op.execute("CREATE INDEX ix_assistant_review ON assistant_conversations(flagged, updated_at)")
    op.execute("""CREATE TABLE assistant_messages (
        id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES assistant_conversations(id),
        role varchar(10) NOT NULL, content text NOT NULL, sources jsonb NOT NULL,
        intent varchar(40) NOT NULL, handoff_reason varchar(30), model varchar(100) NOT NULL,
        tokens_in integer NOT NULL, tokens_out integer NOT NULL, latency_ms integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_assistant_message_role CHECK(role IN ('user','assistant')),
        CONSTRAINT ck_assistant_message_usage CHECK(tokens_in>=0 AND tokens_out>=0 AND latency_ms>=0))""")
    op.execute(
        "CREATE INDEX ix_assistant_message_order ON assistant_messages(conversation_id,created_at,id)"
    )
    op.execute("""CREATE TABLE assistant_daily_usage (
        day date PRIMARY KEY, reserved_tokens integer NOT NULL, requests integer NOT NULL,
        tokens_in integer NOT NULL, tokens_out integer NOT NULL, unknown_usage_requests integer NOT NULL,
        CONSTRAINT ck_assistant_usage_positive CHECK(reserved_tokens>=0 AND requests>=0 AND tokens_in>=0 AND tokens_out>=0 AND unknown_usage_requests>=0))""")
    op.execute("""CREATE TABLE assistant_feedback (
        id uuid PRIMARY KEY, message_id uuid NOT NULL UNIQUE REFERENCES assistant_messages(id),
        helpful boolean NOT NULL, comment text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_assistant_feedback_length CHECK(length(comment)<=500))""")
    op.execute("""CREATE FUNCTION protect_assistant_message() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' AND OLD.created_at < now()-interval '90 days' AND EXISTS(
          SELECT 1 FROM assistant_conversations WHERE id=OLD.conversation_id AND NOT flagged AND inquiry_id IS NULL
        ) THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'assistant_messages are append-only except eligible retention deletion';
      END; $$""")
    op.execute(
        "CREATE TRIGGER assistant_message_append_only BEFORE UPDATE OR DELETE ON assistant_messages FOR EACH ROW EXECUTE FUNCTION protect_assistant_message()"
    )


def downgrade():
    op.execute("DROP TABLE assistant_feedback")
    op.execute("DROP TABLE assistant_messages")
    op.execute("DROP FUNCTION protect_assistant_message()")
    op.execute("DROP TABLE assistant_conversations")
    op.execute("DROP TABLE assistant_daily_usage")
