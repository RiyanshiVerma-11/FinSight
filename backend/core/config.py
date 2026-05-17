import os

class Settings:
    PROJECT_NAME: str = "FinSight API"
    VERSION: str = "3.0.0"
    
    # Environment Settings
    IS_CLOUD: bool = os.environ.get('RENDER') is not None or os.environ.get('IS_CLOUD') == '1'
    
    # Processing Limits
    MAX_ROWS: int = 250000 if IS_CLOUD else 1_000_000
    MIN_USERS_TO_KEEP: int = 100
    
    # Directory Mapping
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATASET_DIR: str = os.path.join(BASE_DIR, "datasets")
    MODEL_DIR: str = os.path.join(BASE_DIR, "models")
    
    # API Integrations
    GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

settings = Settings()
