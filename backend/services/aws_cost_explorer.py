"""
AWS Cost Explorer API: gerçek harcama verisi. Veri 24 saat gecikmeli güncellenir.
"""
from datetime import date
from decimal import Decimal
from typing import Any

import boto3
import botocore

CE_REGION = "us-east-1"


def get_cost_explorer_client():
    """Cost Explorer API client (us-east-1)."""
    return boto3.client("ce", region_name=CE_REGION)


def get_cost_and_usage(
    start_date: str | date,
    end_date: str | date,
    granularity: str = "MONTHLY",
    group_by_service: bool = True,
) -> dict[str, Any]:
    """
    get_cost_and_usage çağrısı yapar.
    start_date, end_date: 'YYYY-MM-DD' veya date; end günü exclusive.
    Dönen yapı: {
      "ResultsByTime": [
        {
          "TimePeriod": {"Start": "...", "End": "..."},
          "Total": {"UnblendedCost": {"Amount": "...", "Unit": "USD"}},
          "Groups": [ {"Keys": ["ServiceName"], "Metrics": {"UnblendedCost": {"Amount": "..."}}} ]
        }
      ],
      "NextToken": ... (varsa)
    }
    Hata durumunda boş dict veya exception (çağıran yakalasın).
    """
    start = str(start_date) if isinstance(start_date, date) else start_date
    end = str(end_date) if isinstance(end_date, date) else end_date
    params = {
        "TimePeriod": {"Start": start, "End": end},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
    }
    if group_by_service:
        params["GroupBy"] = [{"Type": "DIMENSION", "Key": "SERVICE"}]
    try:
        client = get_cost_explorer_client()
        return client.get_cost_and_usage(**params)
    except (botocore.exceptions.ClientError, botocore.exceptions.BotoCoreError):
        return {}


def get_total_cost_usd(start_date: str | date, end_date: str | date) -> Decimal | None:
    """
    Verilen dönem için toplam harcama (UnblendedCost) USD döndürür.
    Tek zaman dilimi (örn. bir ay) varsa o dönemin Total'ı, yoksa ResultsByTime toplamı.
    """
    data = get_cost_and_usage(start_date, end_date, granularity="MONTHLY", group_by_service=False)
    results = data.get("ResultsByTime") or []
    if not results:
        return None
    total = Decimal("0")
    for r in results:
        metrics = (r.get("Total") or {}).get("UnblendedCost") or {}
        amount = metrics.get("Amount")
        if amount is not None:
            total += Decimal(str(amount))
    return total if total else None


def get_cost_by_service(
    start_date: str | date, end_date: str | date
) -> list[tuple[str, Decimal]]:
    """
    Verilen dönem için servis bazında harcama listesi: [(service_name, amount_usd), ...].
    İlk ResultsByTime öğesinin Groups'undan üretilir; boş veya hata durumunda [].
    """
    data = get_cost_and_usage(start_date, end_date, granularity="MONTHLY", group_by_service=True)
    results = data.get("ResultsByTime") or []
    if not results:
        return []
    groups = results[0].get("Groups") or []
    out = []
    for g in groups:
        keys = g.get("Keys") or []
        name = keys[0] if keys else "Unknown"
        metrics = (g.get("Metrics") or {}).get("UnblendedCost") or {}
        amount = metrics.get("Amount")
        if amount is not None:
            out.append((name, Decimal(str(amount))))
    return out
