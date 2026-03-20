from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://decisionflow:decisionflow@db:5432/decisionflow"
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')


settings = Settings()
