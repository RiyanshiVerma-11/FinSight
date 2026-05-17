# Backend Dockerfile
FROM python:3.10-slim

# Set pip environment variables to prevent network timeouts for large packages
ENV PIP_DEFAULT_TIMEOUT=1000
ENV PIP_RETRIES=10

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
RUN python -c "import shap; print('SHAP version:', shap.__version__)"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
