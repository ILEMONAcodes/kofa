from alembic import context
from app.core.config import get_settings
from app.core.database import make_engine
from app.models.identity import Base

settings = get_settings()
url = (
    context.config.attributes.get("database_url")
    or (settings.database_url_unpooled or settings.database_url).get_secret_value()
)
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(url)
    with engine.begin() as connection:
        # CITEXT is needed before schema comparison/table creation.
        connection.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS citext")
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
