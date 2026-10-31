FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml requirements.lock alembic.ini ./
COPY app ./app
COPY alembic ./alembic
RUN pip install --no-cache-dir --constraint requirements.lock . \
    && useradd --create-home --uid 10001 kofa
USER kofa
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
