"""
Maliyet hesaplama kaydı (snapshot) oluşturma.
"""
import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..models import CostSnapshotCreate, CostSnapshotResponse
from ..services.ai_pricing import (
    get_ai_input_packages,
    get_last_ai_packages_pricing_error,
    get_anthropic_input_price_per_mtok,
    get_last_anthropic_pricing_error,
    get_last_openai_pricing_error,
    get_openai_input_price_per_mtok,
)
from ..services.aws_pricing import (
    get_acm_private_ca_price,
    get_bandwidth_data_transfer_price,
    get_backup_rds_snapshot_price,
    get_backup_s3_storage_price,
    get_cloudwatch_metric_price,
    get_last_pricing_error,
    get_cloudfront_price,
    get_ec2_hourly_price,
    get_elastic_ip_hourly_price,
    get_elasticache_hourly_price,
    get_lambda_price,
    get_nat_gateway_hourly_price,
    get_rds_hourly_price,
    get_route53_hosted_zone_price,
    get_s3_requests_price,
    get_s3_storage_price,
    get_secrets_manager_price,
    get_ses_price,
)

from .auth import get_current_user

router = APIRouter(prefix="/costs", tags=["costs"])


def _to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


@router.get("/aws-prices")
def get_aws_unit_prices(
    current_user: dict = Depends(get_current_user),
):
    """Maliyet ekranı için AWS birim fiyatlarını döndürür (USD)."""
    ai_packages = get_ai_input_packages()
    prices = {
        "ec2": _to_float(get_ec2_hourly_price()),
        "rds": _to_float(get_rds_hourly_price()),
        "s3-storage": _to_float(get_s3_storage_price()),
        "s3-requests": _to_float(get_s3_requests_price()),
        "bandwidth": _to_float(get_bandwidth_data_transfer_price()),
        "cloudfront": _to_float(get_cloudfront_price()),
        "route53": _to_float(get_route53_hosted_zone_price()),
        "cloudwatch": _to_float(get_cloudwatch_metric_price()),
        "backup-rds": _to_float(get_backup_rds_snapshot_price()),
        "backup-s3": _to_float(get_backup_s3_storage_price()),
        "nat": _to_float(get_nat_gateway_hourly_price()),
        "elastic-ip": _to_float(get_elastic_ip_hourly_price()),
        "secrets": _to_float(get_secrets_manager_price()),
        "ses": _to_float(get_ses_price()),
        "lambda": _to_float(get_lambda_price()),
        "elasticache": _to_float(get_elasticache_hourly_price()),
        "acm": _to_float(get_acm_private_ca_price()),
        "ai-openai": _to_float(get_openai_input_price_per_mtok()),
        "ai-anthropic": _to_float(get_anthropic_input_price_per_mtok()),
    }
    for pkg in ai_packages:
        prices[pkg["id"]] = _to_float(pkg["unit_price_usd"])
    pricing_error = get_last_pricing_error()
    ai_errors = [
        get_last_openai_pricing_error(),
        get_last_anthropic_pricing_error(),
        get_last_ai_packages_pricing_error(),
    ]
    ai_errors = [e for e in ai_errors if e]
    if pricing_error:
        prices["__error"] = pricing_error
    if ai_errors:
        prices["__error"] = f"{prices.get('__error', '')} | {' | '.join(ai_errors)}".strip(" |")
    return prices


@router.get("/ai-packages")
def get_ai_packages(
    current_user: dict = Depends(get_current_user),
):
    packages = get_ai_input_packages()
    return [
        {
            "id": pkg["id"],
            "provider": pkg["provider"],
            "provider_label": pkg["provider_label"],
            "model_id": pkg["model_id"],
            "model_name": pkg["model_name"],
            "description": pkg.get("description", ""),
            "unit": pkg["unit"],
            "unit_price_usd": _to_float(pkg["unit_price_usd"]),
            "input_price_usd": _to_float(pkg.get("input_price_usd")),
            "output_price_usd": _to_float(pkg.get("output_price_usd")),
            "cache_read_price_usd": _to_float(pkg.get("cache_read_price_usd")),
            "cache_write_5m_price_usd": _to_float(pkg.get("cache_write_5m_price_usd")),
            "cache_write_1h_price_usd": _to_float(pkg.get("cache_write_1h_price_usd")),
        }
        for pkg in packages
    ]


@router.post("", response_model=CostSnapshotResponse, status_code=201)
def create_cost_snapshot(
    body: CostSnapshotCreate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Maliyet hesaplamasını kaydeder (ürün, dönem, kur, toplamlar, snapshot_data)."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM products WHERE id = %s", (body.product_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")
        cur.execute(
            """INSERT INTO cost_snapshots (
                   product_id, period, usd_try_rate, total_cost_usd, total_cost_try,
                   profit_margin_pct, sale_price_usd, sale_price_try, net_profit_usd, net_profit_try,
                   estimated_cost_usd, actual_cost_usd, snapshot_data, created_by_user_id
               ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
               RETURNING id, product_id, created_by_user_id, period, usd_try_rate, total_cost_usd, total_cost_try,
                         profit_margin_pct, sale_price_usd, sale_price_try, net_profit_usd, net_profit_try,
                         estimated_cost_usd, actual_cost_usd, snapshot_data, created_at, NULL::text AS created_by_name""",
            (
                body.product_id,
                body.period,
                body.usd_try_rate,
                body.total_cost_usd,
                body.total_cost_try,
                body.profit_margin_pct,
                body.sale_price_usd,
                body.sale_price_try,
                body.net_profit_usd,
                body.net_profit_try,
                body.estimated_cost_usd,
                body.actual_cost_usd,
                json.dumps(body.snapshot_data),
                current_user["id"],
            ),
        )
        row = cur.fetchone()
    return CostSnapshotResponse.model_validate(row)
