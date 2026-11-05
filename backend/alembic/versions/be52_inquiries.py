"""Inquiry model, private notes, history and client-scoped idempotency."""

from alembic import op

revision = "be52_inquiries"
down_revision = "be44_submissions"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
CREATE TABLE inquiries (
    client_id UUID NOT NULL,
    property_id UUID,
    kind VARCHAR(30) NOT NULL,
    source VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    assigned_staff_id UUID,
    budget_min BIGINT,
    budget_max BIGINT,
    desired_move_in DATE,
    qualified_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_reason TEXT,
    last_client_message_at TIMESTAMP WITH TIME ZONE,
    last_staff_message_at TIMESTAMP WITH TIME ZONE,
    row_version INTEGER NOT NULL,
    id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_inquiry_status CHECK (status IN ('new','in_progress','qualified','inspection_scheduled','negotiating','closed_won','closed_lost','spam')),
    CONSTRAINT ck_inquiry_kind CHECK (kind IN ('property_interest','inspection_request','general')),
    CONSTRAINT ck_inquiry_source CHECK (source IN ('web_form','assistant')),
    CONSTRAINT ck_inquiry_property CHECK ((kind = 'general') = (property_id IS NULL)),
    CONSTRAINT ck_inquiry_min CHECK (budget_min IS NULL OR budget_min >= 0),
    CONSTRAINT ck_inquiry_max CHECK (budget_max IS NULL OR budget_max >= 0),
    CONSTRAINT ck_inquiry_budget CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max),
    FOREIGN KEY(client_id) REFERENCES users (id),
    FOREIGN KEY(property_id) REFERENCES properties (id),
    FOREIGN KEY(assigned_staff_id) REFERENCES users (id)
)

"""
    )
    op.execute("CREATE INDEX ix_inquiry_staff_status ON inquiries (assigned_staff_id, status)")
    op.execute(
        "CREATE UNIQUE INDEX uq_inquiry_open_property ON inquiries (client_id, property_id) WHERE status NOT IN ('closed_won','closed_lost','spam') AND property_id IS NOT NULL"
    )
    op.execute("CREATE INDEX ix_inquiry_client_created ON inquiries (client_id, created_at)")
    op.execute("CREATE INDEX ix_inquiry_status_created ON inquiries (status, created_at)")
    op.execute(
        """
CREATE TABLE inquiry_messages (
    inquiry_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    sender_role VARCHAR(10) NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_message_role CHECK (sender_role IN ('client','staff')),
    CONSTRAINT ck_message_length CHECK (length(body) BETWEEN 1 AND 4000),
    FOREIGN KEY(inquiry_id) REFERENCES inquiries (id),
    FOREIGN KEY(sender_id) REFERENCES users (id)
)

"""
    )
    op.execute(
        "CREATE INDEX ix_inquiry_message_order ON inquiry_messages (inquiry_id, created_at, id)"
    )
    op.execute(
        """
CREATE TABLE inquiry_notes (
    inquiry_id UUID NOT NULL,
    author_id UUID NOT NULL,
    body TEXT NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_note_length CHECK (length(body) BETWEEN 1 AND 4000),
    FOREIGN KEY(inquiry_id) REFERENCES inquiries (id),
    FOREIGN KEY(author_id) REFERENCES users (id)
)

"""
    )
    op.execute("CREATE INDEX ix_inquiry_note_order ON inquiry_notes (inquiry_id, created_at, id)")
    op.execute(
        """
CREATE TABLE inquiry_status_history (
    inquiry_id UUID NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    actor_user_id UUID NOT NULL,
    reason TEXT,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(inquiry_id) REFERENCES inquiries (id),
    FOREIGN KEY(actor_user_id) REFERENCES users (id)
)

"""
    )
    op.execute(
        "CREATE INDEX ix_inquiry_status_history_inquiry_id ON inquiry_status_history (inquiry_id)"
    )
    op.execute(
        """
CREATE TABLE inquiry_requests (
    client_id UUID NOT NULL,
    inquiry_id UUID NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    body_hash VARCHAR(64) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_inquiry_request_key UNIQUE (client_id, key_hash),
    FOREIGN KEY(client_id) REFERENCES users (id),
    FOREIGN KEY(inquiry_id) REFERENCES inquiries (id)
)

"""
    )
    op.execute(
        "CREATE FUNCTION reject_inquiry_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inquiry_status_history is append-only'; END; $$"
    )
    op.execute(
        "CREATE TRIGGER inquiry_history_append_only BEFORE UPDATE OR DELETE ON inquiry_status_history FOR EACH ROW EXECUTE FUNCTION reject_inquiry_history_mutation()"
    )


def downgrade():
    op.execute("DROP TRIGGER inquiry_history_append_only ON inquiry_status_history")
    op.execute("DROP FUNCTION reject_inquiry_history_mutation()")
    for name in [
        "inquiry_requests",
        "inquiry_status_history",
        "inquiry_notes",
        "inquiry_messages",
        "inquiries",
    ]:
        op.drop_table(name)
