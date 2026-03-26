FROM python:3.12-slim

# Install pipenv
RUN pip install --no-cache-dir pipenv

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY app/Pipfile app/Pipfile.lock ./

# Install deps into the system Python (no extra virtualenv inside container)
RUN pipenv install --deploy --system --ignore-pipfile

# Copy application code
COPY app/ .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "main:app"]
