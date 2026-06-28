from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = ""
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    urlscan_api_key: str = ""
    shodan_api_key: str = ""
    threatfox_api_key: str = ""
    hybrid_analysis_api_key: str = ""
    hibp_api_key: str = ""
    intelx_api_key: str = ""
    otx_api_key: str = ""
    ipinfo_api_token: str = ""
    proxycheck_api_key: str = ""
    misp_url: str = ""
    misp_api_key: str = ""
    default_tlp: str = "TLP:AMBER"
    geography: str = ""

    # Paths
    reports_dir: Path = _BACKEND_DIR.parent / "reports"
    skills_root: Path = _BACKEND_DIR.parent.parent / "skills"

    port: int = 8765


settings = Settings()
