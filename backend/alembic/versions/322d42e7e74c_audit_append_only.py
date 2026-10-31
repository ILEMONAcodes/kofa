"""BE-3.3: enforce append-only audit writes in PostgreSQL."""

from alembic import op

revision = "322d42e7e74c"
down_revision = "322d42e7e74b"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit_log is append-only'; END; $$""")
    op.execute(
        "CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()"
    )


def downgrade():
    op.execute("DROP TRIGGER audit_append_only ON audit_log")
    op.execute("DROP FUNCTION reject_audit_mutation()")
