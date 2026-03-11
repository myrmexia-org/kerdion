"""
AI API pricing fetchers.
Returns USD per 1M input tokens.
"""
import re
from decimal import Decimal

import requests

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
OPENAI_OPENROUTER_MODEL_ID = "openai/gpt-5-mini"
ANTHROPIC_OPENROUTER_MODEL_ID = "anthropic/claude-haiku-4.5"
ANTHROPIC_PRICING_URL = "https://docs.claude.com/en/docs/about-claude/pricing"

OPENAI_PRICING_LAST_ERROR: str | None = None
ANTHROPIC_PRICING_LAST_ERROR: str | None = None
AI_PACKAGES_LAST_ERROR: str | None = None


def _set_openai_error(message: str | None):
    global OPENAI_PRICING_LAST_ERROR
    OPENAI_PRICING_LAST_ERROR = message


def _set_anthropic_error(message: str | None):
    global ANTHROPIC_PRICING_LAST_ERROR
    ANTHROPIC_PRICING_LAST_ERROR = message


def get_last_openai_pricing_error() -> str | None:
    return OPENAI_PRICING_LAST_ERROR


def get_last_anthropic_pricing_error() -> str | None:
    return ANTHROPIC_PRICING_LAST_ERROR


def _set_ai_packages_error(message: str | None):
    global AI_PACKAGES_LAST_ERROR
    AI_PACKAGES_LAST_ERROR = message


def get_last_ai_packages_pricing_error() -> str | None:
    return AI_PACKAGES_LAST_ERROR


def _fetch_text(url: str) -> str:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.text


def _fetch_json(url: str) -> dict:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _extract_usd(pattern: str, text: str) -> Decimal | None:
    m = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    try:
        return Decimal(m.group(1))
    except Exception:
        return None


def _extract_openrouter_prompt_price_per_mtok(model_id: str) -> Decimal | None:
    payload = _fetch_json(OPENROUTER_MODELS_URL)
    models = payload.get("data", [])
    model = next((m for m in models if m.get("id") == model_id), None)
    if not model:
        return None
    prompt_price = model.get("pricing", {}).get("prompt")
    if prompt_price is None:
        return None
    # OpenRouter returns USD/token, convert to USD/1M tokens.
    return Decimal(str(prompt_price)) * Decimal("1000000")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return slug or "model"


def _short_description(value: str, limit: int = 120) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    first_sentence = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]
    short = first_sentence if first_sentence else text
    if len(short) <= limit:
        return short
    return short[: limit - 3].rstrip() + "..."


def get_ai_input_packages() -> list[dict]:
    """
    OpenAI + Anthropic modellerinin input fiyat paketlerini döndürür.
    unit_price_usd: USD / 1M input token
    """
    try:
        payload = _fetch_json(OPENROUTER_MODELS_URL)
        models = payload.get("data", [])
        packages = []
        for model in models:
            model_id = str(model.get("id") or "")
            provider = ""
            provider_label = ""
            if model_id.startswith("openai/"):
                provider = "openai"
                provider_label = "OpenAI"
            elif model_id.startswith("anthropic/"):
                provider = "anthropic"
                provider_label = "Anthropic"
            else:
                continue

            prompt_price = model.get("pricing", {}).get("prompt")
            if prompt_price is None:
                continue
            try:
                unit_price_usd = Decimal(str(prompt_price)) * Decimal("1000000")
            except Exception:
                continue
            pricing = model.get("pricing", {}) or {}

            def _to_mtok(value):
                if value is None:
                    return None
                try:
                    return Decimal(str(value)) * Decimal("1000000")
                except Exception:
                    return None

            output_price_usd = _to_mtok(pricing.get("completion"))
            cache_read_price_usd = _to_mtok(pricing.get("input_cache_read"))
            cache_write_price_usd = _to_mtok(pricing.get("input_cache_write"))
            cache_write_5m_usd = cache_write_price_usd
            cache_write_1h_usd = None
            if provider == "anthropic" and unit_price_usd is not None:
                # Anthropic dokümantasyonunda 1 saat cache write fiyatı
                # standart olarak base input fiyatının 2x'i.
                cache_write_1h_usd = unit_price_usd * Decimal("2")

            short_model_id = model_id.split("/", 1)[1] if "/" in model_id else model_id
            model_name = str(model.get("name") or short_model_id)
            model_description = _short_description(str(model.get("description") or ""))
            packages.append(
                {
                    "id": f"ai-{provider}-{_slugify(short_model_id)}",
                    "provider": provider,
                    "provider_label": provider_label,
                    "model_id": short_model_id,
                    "model_name": model_name,
                    "description": model_description,
                    "unit": "1M input token",
                    "unit_price_usd": unit_price_usd,
                    "input_price_usd": unit_price_usd,
                    "output_price_usd": output_price_usd,
                    "cache_read_price_usd": cache_read_price_usd,
                    "cache_write_5m_price_usd": cache_write_5m_usd,
                    "cache_write_1h_price_usd": cache_write_1h_usd,
                }
            )

        packages.sort(key=lambda p: (p["provider"], p["model_name"].lower()))
        _set_ai_packages_error(None)
        return packages
    except Exception as exc:
        _set_ai_packages_error(f"AI paket fiyatları alınamadı: {exc}")
        return []


def get_openai_input_price_per_mtok() -> Decimal | None:
    """
    OpenAI public pricing: picks GPT-5 mini input price (USD / 1M tokens).
    """
    try:
        price = _extract_openrouter_prompt_price_per_mtok(OPENAI_OPENROUTER_MODEL_ID)
        _set_openai_error(None if price is not None else "OpenAI fiyatı parse edilemedi")
        return price
    except Exception as exc:
        _set_openai_error(f"OpenAI fiyatı alınamadı: {exc}")
        return None


def get_anthropic_input_price_per_mtok() -> Decimal | None:
    """
    Anthropic public pricing: picks Haiku 4.5 input price (USD / MTok).
    """
    try:
        price = _extract_openrouter_prompt_price_per_mtok(ANTHROPIC_OPENROUTER_MODEL_ID)
        if price is None:
            # Fallback to Anthropic docs markdown if OpenRouter id changes.
            text = _fetch_text(ANTHROPIC_PRICING_URL)
            price = _extract_usd(r"\|\s*Claude Haiku 4\.5\s*\|\s*\$([0-9]+(?:\.[0-9]+)?)\s*/\s*MTok", text)
            if price is None:
                price = _extract_usd(r"\|\s*Claude Haiku\s*4(?:\.[0-9]+)?\s*\|\s*\$([0-9]+(?:\.[0-9]+)?)\s*/\s*MTok", text)
            if price is None:
                price = _extract_usd(r"Haiku.*?\$([0-9]+(?:\.[0-9]+)?)\s*/\s*MTok", text)
        _set_anthropic_error(None if price is not None else "Anthropic fiyatı parse edilemedi")
        return price
    except Exception as exc:
        _set_anthropic_error(f"Anthropic fiyatı alınamadı: {exc}")
        return None
