from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker


def make_engine(connection: str):
    if connection.startswith("postgres://"):
        connection = connection.replace("postgres://", "postgresql://", 1)
    url = make_url(connection).set(drivername="postgresql+psycopg")
    # Psycopg automatic prepared statements do not fit transaction-mode pooling.
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"prepare_threshold": None, "connect_timeout": 10},
        hide_parameters=True,
    )


def get_db(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def session_factory(engine):
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
