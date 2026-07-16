import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/ebbinghaus.db")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

OPENAI_DISABLE_THINKING = os.getenv("OPENAI_DISABLE_THINKING", "true").lower() in {
    "1",
    "true",
    "yes",
}

DICT_DB_PATH = os.getenv("DICT_DB_PATH", "/data/ecdict.db")
ECDICT_DOWNLOAD_URL = os.getenv(
    "ECDICT_DOWNLOAD_URL",
    "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip",
)
IP_LOG_PATH = os.getenv("IP_LOG_PATH", "/data/ip.log")
