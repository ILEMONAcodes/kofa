"""Appointments with concurrent slot exclusions and immutable history."""

from alembic import op

revision = "be62_appointments"
down_revision = "be52_inquiries"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("""
CREATE TABLE appointments (
    inquiry_id UUID NOT NULL,
    property_id UUID NOT NULL,
    client_id UUID NOT NULL,
    staff_id UUID NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,
    meeting_address TEXT,
    meeting_instructions TEXT,
    landlord_rep_name VARCHAR(150),
    landlord_rep_phone VARCHAR(20),
    address_disclosed_at TIMESTAMP WITH TIME ZONE,
    requested_scheduled_at TIMESTAMP WITH TIME ZONE,
    reschedule_reason TEXT,
    cancellation_reason TEXT,
    outcome VARCHAR(30),
    outcome_notes TEXT,
    fee_amount BIGINT DEFAULT '0' NOT NULL,
    fee_status VARCHAR(20) DEFAULT 'none' NOT NULL,
    row_version INTEGER NOT NULL,
    id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_appointment_status CHECK (status IN ('proposed','confirmed','reschedule_requested','completed','cancelled_by_client','cancelled_by_staff','cancelled_by_landlord','no_show')),
    CONSTRAINT ck_appointment_fee_disabled CHECK (fee_amount = 0 AND fee_status = 'none'),
    CONSTRAINT ck_appointment_interval CHECK (ends_at = scheduled_at + duration_minutes * interval '1 minute'),
    CONSTRAINT ck_appointment_duration CHECK (duration_minutes BETWEEN 15 AND 240),
    CONSTRAINT ck_appointment_outcome CHECK (outcome IS NULL OR outcome IN ('interested','not_interested','needs_follow_up')),
    CONSTRAINT ex_appointment_staff_slot EXCLUDE USING gist (staff_id WITH =, tstzrange(scheduled_at, ends_at, '[)') WITH &&) WHERE (status IN ('proposed','confirmed','reschedule_requested')),
    CONSTRAINT ex_appointment_property_slot EXCLUDE USING gist (property_id WITH =, tstzrange(scheduled_at, ends_at, '[)') WITH &&) WHERE (status IN ('proposed','confirmed','reschedule_requested')),
    FOREIGN KEY(inquiry_id) REFERENCES inquiries (id),
    FOREIGN KEY(property_id) REFERENCES properties (id),
    FOREIGN KEY(client_id) REFERENCES users (id),
    FOREIGN KEY(staff_id) REFERENCES users (id)
)

""")
    op.execute("CREATE INDEX ix_appointment_client_date ON appointments (client_id, scheduled_at)")
    op.execute("CREATE INDEX ix_appointment_staff_date ON appointments (staff_id, scheduled_at)")
    op.execute("CREATE INDEX ix_appointment_status_date ON appointments (status, scheduled_at)")
    op.execute(
        "CREATE UNIQUE INDEX uq_appointment_active_inquiry ON appointments (inquiry_id) WHERE status IN ('proposed','confirmed','reschedule_requested')"
    )
    op.execute("""
CREATE TABLE appointment_status_history (
    appointment_id UUID NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    actor_user_id UUID NOT NULL,
    reason TEXT,
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(appointment_id) REFERENCES appointments (id),
    FOREIGN KEY(actor_user_id) REFERENCES users (id)
)

""")
    op.execute(
        "CREATE INDEX ix_appointment_history ON appointment_status_history (appointment_id, created_at, id)"
    )
    op.execute(
        "CREATE FUNCTION reject_appointment_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'appointment_status_history is append-only'; END; $$"
    )
    op.execute(
        "CREATE TRIGGER appointment_history_append_only BEFORE UPDATE OR DELETE ON appointment_status_history FOR EACH ROW EXECUTE FUNCTION reject_appointment_history_mutation()"
    )


def downgrade():
    op.execute("DROP TRIGGER appointment_history_append_only ON appointment_status_history")
    op.execute("DROP FUNCTION reject_appointment_history_mutation()")
    op.drop_table("appointment_status_history")
    op.drop_table("appointments")
    # Preserve btree_gist: other modules may use this shared extension.
