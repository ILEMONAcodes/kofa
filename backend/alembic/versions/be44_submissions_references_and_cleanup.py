"""BE-4.4 stable submission references and durable private-file deletion queue."""

import sqlalchemy as sa

from alembic import op

revision = "be44_submissions"
down_revision = "be42_properties"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SEQUENCE landlord_submission_reference_seq")
    op.add_column("properties", sa.Column("submission_reference", sa.String(40), nullable=True))
    op.create_unique_constraint(
        "uq_property_submission_reference", "properties", ["submission_reference"]
    )
    op.create_table(
        "storage_deletions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("storage_key", sa.Text(), nullable=False, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade():
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM properties WHERE submission_reference IS NOT NULL)
        OR EXISTS (SELECT 1 FROM storage_deletions) THEN
        RAISE EXCEPTION 'Cannot downgrade with submission references or pending file deletions';
        END IF; END $$""")
    op.drop_table("storage_deletions")
    op.drop_constraint("uq_property_submission_reference", "properties", type_="unique")
    op.drop_column("properties", "submission_reference")
    op.execute("DROP SEQUENCE landlord_submission_reference_seq")
