FROM ghcr.io/mykhayloserdyuk/buena-backend-base:latest

WORKDIR /app

# Install lightweight app dependencies on top of the base
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
