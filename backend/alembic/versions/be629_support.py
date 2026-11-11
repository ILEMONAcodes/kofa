"""Support settings and editorial knowledge, no published or personal seed records."""

from alembic import op

revision = "be629_support"
down_revision = "be615_complaints"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE site_settings (
      key varchar(60) PRIMARY KEY, value jsonb NOT NULL,
      updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now())""")
    op.execute("""CREATE TABLE knowledge_articles (
      id uuid PRIMARY KEY, slug varchar(180) NOT NULL UNIQUE,
      title varchar(160) NOT NULL, body text NOT NULL,
      category varchar(30) NOT NULL, language varchar(2) NOT NULL,
      status varchar(20) NOT NULL, published_by uuid REFERENCES users(id),
      published_at timestamptz, created_by uuid NOT NULL REFERENCES users(id),
      row_version integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ck_knowledge_status CHECK (status IN ('draft','published')),
      CONSTRAINT ck_knowledge_category CHECK (category IN ('how_it_works','fees','verification','inspections','policies','reporting','contact','other')),
      CONSTRAINT ck_knowledge_language CHECK (language = 'en'),
      CONSTRAINT ck_knowledge_version CHECK (row_version > 0),
      CONSTRAINT ck_knowledge_published CHECK (status <> 'published' OR (published_at IS NOT NULL AND published_by IS NOT NULL)))""")
    op.execute("CREATE INDEX ix_knowledge_status_updated ON knowledge_articles(status,updated_at)")
    op.execute(
        "CREATE INDEX ix_knowledge_text ON knowledge_articles USING gin (((title::text || ' '::text) || body) gin_trgm_ops)"
    )


def downgrade():
    op.execute("DROP TABLE knowledge_articles")
    op.execute("DROP TABLE site_settings")
