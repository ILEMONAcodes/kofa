"""BE-4.2 property and media metadata
Revision ID: be42_properties
Revises: 322d42e7e74c
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "be42_properties"
down_revision = "322d42e7e74c"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "amenities",
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "areas",
        sa.Column("state", sa.String(length=60), nullable=False),
        sa.Column("city", sa.String(length=60), nullable=False),
        sa.Column("neighbourhood", sa.String(length=80), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_area_latitude"),
        sa.CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_area_longitude"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("state", "city", "neighbourhood", name="uq_area_location"),
    )
    op.create_table(
        "landlords",
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=True),
        sa.Column("identity_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("identity_verified_by", sa.UUID(), nullable=True),
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["identity_verified_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_landlords_email"), "landlords", ["email"], unique=False)
    op.create_index(op.f("ix_landlords_phone"), "landlords", ["phone"], unique=False)
    op.create_table(
        "properties",
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("landlord_id", sa.UUID(), nullable=False),
        sa.Column("area_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("listing_type", sa.String(length=10), nullable=False),
        sa.Column("property_type", sa.String(length=20), nullable=False),
        sa.Column(
            "intended_use", sa.String(length=20), server_default="residential", nullable=False
        ),
        sa.Column("relationship", sa.String(length=30), nullable=False),
        sa.Column("price_amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="NGN", nullable=False),
        sa.Column("price_period", sa.String(length=10), nullable=False),
        sa.Column(
            "price_negotiable", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column(
            "extra_charges",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("bedrooms", sa.SmallInteger(), nullable=False),
        sa.Column("bathrooms", sa.SmallInteger(), nullable=False),
        sa.Column("furnishing", sa.String(length=15), nullable=False),
        sa.Column("address_line", sa.Text(), nullable=False),
        sa.Column("address_hint", sa.String(length=160), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("landlord_conditions", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column(
            "availability_status", sa.String(length=15), server_default="available", nullable=False
        ),
        sa.Column("last_availability_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_staff_id", sa.UUID(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(listing_type = 'sale' AND price_period = 'one_time') OR (listing_type = 'rent' AND price_period IN ('month','year'))",
            name="ck_property_price_period",
        ),
        sa.CheckConstraint(
            "availability_status IN ('available','under_offer','unavailable')",
            name="ck_property_availability",
        ),
        sa.CheckConstraint("currency = 'NGN'", name="ck_property_currency"),
        sa.CheckConstraint(
            "furnishing IN ('furnished','semi_furnished','unfurnished')",
            name="ck_property_furnishing",
        ),
        sa.CheckConstraint("intended_use = 'residential'", name="ck_property_intended_use"),
        sa.CheckConstraint(
            "jsonb_typeof(extra_charges) = 'array'", name="ck_property_extra_charges"
        ),
        sa.CheckConstraint("listing_type IN ('rent','sale')", name="ck_property_listing_type"),
        sa.CheckConstraint(
            "property_type IN ('apartment','house','duplex','bungalow','terrace','studio','room')",
            name="ck_property_type",
        ),
        sa.CheckConstraint(
            "relationship IN ('owner','authorized_agent','developer','property_manager')",
            name="ck_property_relationship",
        ),
        sa.CheckConstraint(
            "status IN ('draft','submitted','in_review','changes_requested','approved','published','unpublished','rejected','archived')",
            name="ck_property_status",
        ),
        sa.CheckConstraint(
            "bedrooms BETWEEN 0 AND 20 AND bathrooms BETWEEN 0 AND 20", name="ck_property_rooms"
        ),
        sa.CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_property_latitude"),
        sa.CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_property_longitude"),
        sa.CheckConstraint("price_amount > 0", name="ck_property_price"),
        sa.CheckConstraint("row_version > 0", name="ck_property_version"),
        sa.ForeignKeyConstraint(
            ["area_id"],
            ["areas.id"],
        ),
        sa.ForeignKeyConstraint(
            ["assigned_staff_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["landlord_id"],
            ["landlords.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_properties_area_id"), "properties", ["area_id"], unique=False)
    op.create_index(
        op.f("ix_properties_availability_status"),
        "properties",
        ["availability_status"],
        unique=False,
    )
    op.create_index(op.f("ix_properties_bedrooms"), "properties", ["bedrooms"], unique=False)
    op.create_index(op.f("ix_properties_landlord_id"), "properties", ["landlord_id"], unique=False)
    op.create_index(
        op.f("ix_properties_price_amount"), "properties", ["price_amount"], unique=False
    )
    op.create_index(
        "ix_property_listing_type", "properties", ["listing_type", "property_type"], unique=False
    )
    op.create_index(
        "ix_property_public_search",
        "properties",
        ["area_id", "price_amount"],
        unique=False,
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "ix_property_staff_status", "properties", ["assigned_staff_id", "status"], unique=False
    )
    op.create_index(
        "ix_property_status_published", "properties", ["status", "published_at"], unique=False
    )
    op.create_index(
        "ix_property_text",
        "properties",
        [sa.literal_column("(title || ' ' || description) gin_trgm_ops")],
        unique=False,
        postgresql_using="gin",
    )
    op.create_table(
        "property_amenities",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("amenity_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["amenity_id"],
            ["amenities.id"],
        ),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("property_id", "amenity_id"),
    )
    op.create_table(
        "property_documents",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('ownership_proof','authorization_letter','id_document','other')",
            name="ck_document_kind",
        ),
        sa.CheckConstraint("size_bytes > 0", name="ck_document_size"),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(
        op.f("ix_property_documents_property_id"),
        "property_documents",
        ["property_id"],
        unique=False,
    )
    op.create_table(
        "property_landlord_approvals",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("approved_price_amount", sa.BigInteger(), nullable=False),
        sa.Column("approved_price_period", sa.String(length=10), nullable=False),
        sa.Column("description_approved", sa.Boolean(), nullable=False),
        sa.Column("method", sa.String(length=15), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("recorded_by", sa.UUID(), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "approved_price_period IN ('month','year','one_time')", name="ck_approval_period"
        ),
        sa.CheckConstraint(
            "method IN ('phone','whatsapp','email','in_person')", name="ck_approval_method"
        ),
        sa.CheckConstraint("approved_price_amount > 0", name="ck_approval_price"),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_property_landlord_approvals_property_id"),
        "property_landlord_approvals",
        ["property_id"],
        unique=False,
    )
    op.create_index(
        "uq_current_landlord_approval",
        "property_landlord_approvals",
        ["property_id"],
        unique=True,
        postgresql_where=sa.text("superseded_at IS NULL"),
    )
    op.create_table(
        "property_media",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("thumb_key", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("alt_text", sa.String(length=200), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_cover", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("uploaded_by", sa.String(length=30), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("NOT is_cover OR kind = 'photo'", name="ck_media_cover_photo"),
        sa.CheckConstraint("kind IN ('photo','video')", name="ck_media_kind"),
        sa.CheckConstraint(
            "uploaded_by IN ('landlord_submission','staff')", name="ck_media_uploaded_by"
        ),
        sa.CheckConstraint("height IS NULL OR height > 0", name="ck_media_height"),
        sa.CheckConstraint("position >= 0", name="ck_media_position"),
        sa.CheckConstraint("size_bytes > 0", name="ck_media_size"),
        sa.CheckConstraint("width IS NULL OR width > 0", name="ck_media_width"),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(
        "ix_media_property_position", "property_media", ["property_id", "position"], unique=False
    )
    op.create_index(
        "uq_property_cover",
        "property_media",
        ["property_id"],
        unique=True,
        postgresql_where=sa.text("is_cover"),
    )
    op.create_index(
        "uq_property_video",
        "property_media",
        ["property_id"],
        unique=True,
        postgresql_where=sa.text("kind = 'video'"),
    )
    op.create_table(
        "property_status_history",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "from_status IN ('draft','submitted','in_review','changes_requested','approved','published','unpublished','rejected','archived')",
            name="ck_history_from_status",
        ),
        sa.CheckConstraint(
            "to_status IN ('draft','submitted','in_review','changes_requested','approved','published','unpublished','rejected','archived')",
            name="ck_history_to_status",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_property_history_created",
        "property_status_history",
        ["property_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "property_verifications",
        sa.Column("property_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=15), server_default="in_progress", nullable=False),
        sa.Column("method", sa.String(length=25), nullable=False),
        sa.Column("scope_summary", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.UUID(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "method IN ('desk_review','physical_inspection','both')", name="ck_verification_method"
        ),
        sa.CheckConstraint(
            "status IN ('in_progress','passed','failed')", name="ck_verification_status"
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
        ),
        sa.ForeignKeyConstraint(
            ["verified_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_property_verifications_property_id"),
        "property_verifications",
        ["property_id"],
        unique=False,
    )
    op.create_index(
        "uq_current_verification",
        "property_verifications",
        ["property_id"],
        unique=True,
        postgresql_where=sa.text("is_current"),
    )
    op.create_table(
        "verification_checks",
        sa.Column("verification_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("result", sa.String(length=5), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("evidence_document_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.CheckConstraint(
            "code IN ('identity','ownership_docs','location','price','features','availability')",
            name="ck_verification_check_code",
        ),
        sa.CheckConstraint("result IN ('pass','fail','na')", name="ck_verification_check_result"),
        sa.ForeignKeyConstraint(
            ["evidence_document_id"],
            ["property_documents.id"],
        ),
        sa.ForeignKeyConstraint(
            ["verification_id"], ["property_verifications.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("verification_id", "code", name="uq_verification_check"),
    )
    op.add_column("policy_acceptances", sa.Column("landlord_id", sa.UUID(), nullable=True))
    op.alter_column("policy_acceptances", "user_id", existing_type=sa.UUID(), nullable=True)
    op.create_index(
        op.f("ix_policy_acceptances_landlord_id"),
        "policy_acceptances",
        ["landlord_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_policy_landlord", "policy_acceptances", "landlords", ["landlord_id"], ["id"]
    )
    op.create_check_constraint(
        "ck_policy_subject",
        "policy_acceptances",
        "(user_id IS NOT NULL) <> (landlord_id IS NOT NULL)",
    )
    op.execute("""CREATE FUNCTION reject_property_history_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'property_status_history is append-only'; END; $$""")
    op.execute("""CREATE TRIGGER property_history_append_only BEFORE UPDATE OR DELETE
        ON property_status_history FOR EACH ROW
        EXECUTE FUNCTION reject_property_history_mutation()""")


def downgrade():
    # Older revision cannot represent landlord consent: fail before any destructive DDL.
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM policy_acceptances WHERE landlord_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Cannot downgrade while landlord consent records exist';
        END IF; END $$""")
    op.execute("DROP TRIGGER property_history_append_only ON property_status_history")
    op.execute("DROP FUNCTION reject_property_history_mutation()")
    op.drop_constraint("ck_policy_subject", "policy_acceptances", type_="check")
    op.drop_constraint("fk_policy_landlord", "policy_acceptances", type_="foreignkey")
    op.drop_index(op.f("ix_policy_acceptances_landlord_id"), table_name="policy_acceptances")
    op.alter_column("policy_acceptances", "user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("policy_acceptances", "landlord_id")
    op.drop_table("verification_checks")
    op.drop_index(
        "uq_current_verification",
        table_name="property_verifications",
        postgresql_where=sa.text("is_current"),
    )
    op.drop_index(
        op.f("ix_property_verifications_property_id"), table_name="property_verifications"
    )
    op.drop_table("property_verifications")
    op.drop_index("ix_property_history_created", table_name="property_status_history")
    op.drop_table("property_status_history")
    op.drop_index(
        "uq_property_video", table_name="property_media", postgresql_where=sa.text("kind = 'video'")
    )
    op.drop_index(
        "uq_property_cover", table_name="property_media", postgresql_where=sa.text("is_cover")
    )
    op.drop_index("ix_media_property_position", table_name="property_media")
    op.drop_table("property_media")
    op.drop_index(
        "uq_current_landlord_approval",
        table_name="property_landlord_approvals",
        postgresql_where=sa.text("superseded_at IS NULL"),
    )
    op.drop_index(
        op.f("ix_property_landlord_approvals_property_id"), table_name="property_landlord_approvals"
    )
    op.drop_table("property_landlord_approvals")
    op.drop_index(op.f("ix_property_documents_property_id"), table_name="property_documents")
    op.drop_table("property_documents")
    op.drop_table("property_amenities")
    op.drop_index("ix_property_text", table_name="properties", postgresql_using="gin")
    op.drop_index("ix_property_status_published", table_name="properties")
    op.drop_index("ix_property_staff_status", table_name="properties")
    op.drop_index(
        "ix_property_public_search",
        table_name="properties",
        postgresql_where=sa.text("status = 'published'"),
    )
    op.drop_index("ix_property_listing_type", table_name="properties")
    op.drop_index(op.f("ix_properties_price_amount"), table_name="properties")
    op.drop_index(op.f("ix_properties_landlord_id"), table_name="properties")
    op.drop_index(op.f("ix_properties_bedrooms"), table_name="properties")
    op.drop_index(op.f("ix_properties_availability_status"), table_name="properties")
    op.drop_index(op.f("ix_properties_area_id"), table_name="properties")
    op.drop_table("properties")
    op.drop_index(op.f("ix_landlords_phone"), table_name="landlords")
    op.drop_index(op.f("ix_landlords_email"), table_name="landlords")
    op.drop_table("landlords")
    op.drop_table("areas")
    op.drop_table("amenities")
    # pg_trgm is shared infrastructure and deliberately retained on downgrade.
