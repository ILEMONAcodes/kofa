"""Private complaints and evidence with immutable events."""

from alembic import op

revision = "be615_complaints"
down_revision = "be62_appointments"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
CREATE TABLE complaints (
	id UUID NOT NULL,
	kind VARCHAR(30) NOT NULL,
	reason VARCHAR(40),
	status VARCHAR(20) NOT NULL,
	reporter_user_id UUID,
	reporter_name VARCHAR(150),
	reporter_email VARCHAR(254),
	reporter_phone VARCHAR(20),
	reporter_ip_hash VARCHAR(64) NOT NULL,
	property_id UUID,
	appointment_id UUID,
	description TEXT NOT NULL,
	occurred_on DATE,
	desired_outcome TEXT,
	assigned_staff_id UUID,
	investigation_findings TEXT,
	evidence_reviewed TEXT,
	outcome VARCHAR(30),
	actions_taken TEXT[] DEFAULT '{}' NOT NULL,
	dismiss_reason VARCHAR(40),
	public_note TEXT,
	hold_property_id UUID,
	hold_review_due_at TIMESTAMP WITH TIME ZONE,
	first_response_at TIMESTAMP WITH TIME ZONE,
	resolved_at TIMESTAMP WITH TIME ZONE,
	upload_token_hash VARCHAR(64) NOT NULL,
	upload_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	row_version INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT ck_complaint_kind CHECK (kind IN ('suspicious_listing','dispute','service_complaint','other')),
	CONSTRAINT ck_complaint_status CHECK (status IN ('new','triage','investigating','resolved','dismissed')),
	CONSTRAINT ck_report_subject CHECK (kind <> 'suspicious_listing' OR (property_id IS NOT NULL AND reason IS NOT NULL)),
	CONSTRAINT ck_complaint_resolution CHECK (status <> 'resolved' OR (investigation_findings IS NOT NULL AND evidence_reviewed IS NOT NULL AND length(trim(investigation_findings)) > 0 AND length(trim(evidence_reviewed)) > 0 AND outcome IS NOT NULL AND cardinality(actions_taken) > 0)),
	CONSTRAINT ck_complaint_dismiss CHECK (status <> 'dismissed' OR dismiss_reason IS NOT NULL),
	CONSTRAINT ck_complaint_reason CHECK (reason IS NULL OR reason IN ('fake_listing','wrong_price','misleading_description','already_let_or_sold','unauthorised_agent','asked_to_pay_outside','other')),
	CONSTRAINT ck_complaint_outcome CHECK (outcome IS NULL OR outcome IN ('substantiated','partially_substantiated','unsubstantiated','inconclusive')),
	CONSTRAINT ck_complaint_dismiss_reason CHECK (dismiss_reason IS NULL OR dismiss_reason IN ('duplicate','spam_or_abuse','out_of_scope','insufficient_information')),
	CONSTRAINT ck_complaint_actions CHECK (actions_taken <@ ARRAY['listing_corrected','listing_unpublished','listing_rejected','landlord_warned','landlord_blocked','client_warned','no_action']::text[]),
	CONSTRAINT ck_complaint_permanent_findings CHECK (NOT actions_taken && ARRAY['landlord_blocked','listing_rejected']::text[] OR (outcome IS NOT NULL AND outcome IN ('substantiated','partially_substantiated'))),
	FOREIGN KEY(reporter_user_id) REFERENCES users (id),
	FOREIGN KEY(property_id) REFERENCES properties (id),
	FOREIGN KEY(appointment_id) REFERENCES appointments (id),
	FOREIGN KEY(assigned_staff_id) REFERENCES users (id),
	FOREIGN KEY(hold_property_id) REFERENCES properties (id)
)
""")
    op.execute("CREATE INDEX ix_complaint_assignment ON complaints (assigned_staff_id, status)")
    op.execute(
        "CREATE INDEX ix_complaint_hold ON complaints (hold_property_id, hold_review_due_at)"
    )
    op.execute("CREATE INDEX ix_complaint_owner ON complaints (reporter_user_id, created_at)")
    op.execute("CREATE INDEX ix_complaint_property ON complaints (property_id)")
    op.execute("CREATE INDEX ix_complaint_queue ON complaints (status, created_at)")
    op.execute("""
CREATE TABLE complaint_evidence (
	id UUID NOT NULL,
	complaint_id UUID NOT NULL,
	storage_key TEXT NOT NULL,
	mime_type VARCHAR(100) NOT NULL,
	size_bytes INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT ck_complaint_file_size CHECK (size_bytes > 0 AND size_bytes <= 5242880),
	FOREIGN KEY(complaint_id) REFERENCES complaints (id) ON DELETE CASCADE,
	UNIQUE (storage_key)
)
""")
    op.execute(
        "CREATE INDEX ix_complaint_evidence_complaint_id ON complaint_evidence (complaint_id)"
    )
    op.execute("""
CREATE TABLE complaint_events (
	id UUID NOT NULL,
	complaint_id UUID NOT NULL,
	from_status VARCHAR(20),
	to_status VARCHAR(20) NOT NULL,
	actor_user_id UUID,
	note TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(complaint_id) REFERENCES complaints (id),
	FOREIGN KEY(actor_user_id) REFERENCES users (id)
)
""")
    op.execute("CREATE INDEX ix_complaint_events_complaint_id ON complaint_events (complaint_id)")
    op.execute(
        "CREATE FUNCTION reject_complaint_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'complaint_events is append-only'; END; $$"
    )
    op.execute(
        "CREATE TRIGGER complaint_events_append_only BEFORE UPDATE OR DELETE ON complaint_events FOR EACH ROW EXECUTE FUNCTION reject_complaint_event_mutation()"
    )


def downgrade():
    op.execute("DROP TRIGGER complaint_events_append_only ON complaint_events")
    op.execute("DROP FUNCTION reject_complaint_event_mutation()")
    op.drop_table("complaint_events")
    op.drop_table("complaint_evidence")
    op.drop_table("complaints")
