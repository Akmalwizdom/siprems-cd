FROM python:3.9-slim

WORKDIR /app

# Install dependensi sistem untuk Prophet dan Postgres
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY .env .env


CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]