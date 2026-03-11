"""
AWS Pricing API: birim fiyat sorgulama. Sadece us-east-1 kullanılır.
"""
import json
from decimal import Decimal
from typing import Any

import boto3
import botocore

# README: Pricing API sadece us-east-1'den sorgulanır
PRICING_REGION = "us-east-1"
PRICING_LAST_ERROR: str | None = None


def _set_last_error(message: str | None):
    global PRICING_LAST_ERROR
    PRICING_LAST_ERROR = message


def get_last_pricing_error() -> str | None:
    return PRICING_LAST_ERROR


def get_pricing_client():
    """Pricing API client (us-east-1)."""
    return boto3.client("pricing", region_name=PRICING_REGION)


def get_products(service_code: str, filters: list[dict[str, str]]) -> list[dict[str, Any]]:
    """
    get_products çağrısı yapar; PriceList içindeki JSON'ları parse edip liste döndürür.
    filters: [{"Type": "TERM_MATCH", "Field": "...", "Value": "..."}, ...]
    """
    _set_last_error(None)
    client = get_pricing_client()
    result = []
    next_token = None
    while True:
        params = {"ServiceCode": service_code, "Filters": filters}
        if next_token:
            params["NextToken"] = next_token
        try:
            response = client.get_products(**params)
        except botocore.exceptions.ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "UnknownError")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            _set_last_error(f"{code}: {msg}")
            return []
        except botocore.exceptions.BotoCoreError as exc:
            _set_last_error(str(exc))
            return []
        for item in response.get("PriceList", []):
            if isinstance(item, str):
                try:
                    result.append(json.loads(item))
                except json.JSONDecodeError:
                    continue
            elif isinstance(item, dict):
                result.append(item)
        next_token = response.get("NextToken")
        if not next_token:
            break
    return result


def extract_on_demand_price_usd(product: dict[str, Any]) -> Decimal | None:
    """
    Tek bir product (parse edilmiş PriceList öğesi) içinden
    OnDemand ilk fiyat boyutunun USD değerini döndürür.
    """
    try:
        terms = product.get("terms") or {}
        on_demand = terms.get("OnDemand") or {}
        if not on_demand:
            return None
        first_term = next(iter(on_demand.values()))
        dims = (first_term or {}).get("priceDimensions") or {}
        if not dims:
            return None
        first_dim = next(iter(dims.values()))
        price_per = (first_dim or {}).get("pricePerUnit") or {}
        usd = price_per.get("USD")
        if usd is None:
            return None
        return Decimal(str(usd))
    except (StopIteration, TypeError, KeyError):
        return None


def get_price(service_code: str, filters: list[dict[str, str]]) -> Decimal | None:
    """
    Verilen servis ve filtreyle ilk eşleşen ürünün OnDemand USD birim fiyatını döndürür.
    Sonuç yoksa veya hata olursa None.
    """
    products = get_products(service_code, filters)
    for p in products:
        price = extract_on_demand_price_usd(p)
        if price is not None:
            return price
    return None


def _select_price(
    service_code: str,
    filters: list[dict[str, str]],
    predicate,
) -> Decimal | None:
    products = get_products(service_code, filters)
    for p in products:
        price = extract_on_demand_price_usd(p)
        if price is None:
            continue
        attrs = (p.get("product") or {}).get("attributes") or {}
        if predicate(attrs):
            return price
    return None


# ----- Servis kodları (README tablosu) -----
SERVICE_EC2 = "AmazonEC2"
SERVICE_RDS = "AmazonRDS"
SERVICE_S3 = "AmazonS3"
SERVICE_CLOUDFRONT = "AmazonCloudFront"
SERVICE_ROUTE53 = "AmazonRoute53"
SERVICE_SECRETS_MANAGER = "AWSSecretsManager"
SERVICE_SES = "AmazonSES"
SERVICE_LAMBDA = "AWSLambda"
SERVICE_ELASTICACHE = "AmazonElastiCache"
SERVICE_BACKUP = "AWSBackup"
SERVICE_CLOUDWATCH = "AmazonCloudWatch"
SERVICE_ACM = "AWSCertificateManager"
SERVICE_DATA_TRANSFER = "AWSDataTransfer"
SERVICE_VPC = "AmazonVPC"


def _term_match(field: str, value: str) -> dict[str, str]:
    return {"Type": "TERM_MATCH", "Field": field, "Value": value}


def get_ec2_hourly_price(
    instance_type: str = "t3.small",
    location: str = "US East (N. Virginia)",
    operating_system: str = "Linux",
) -> Decimal | None:
    """EC2 On-Demand saatlik fiyat (Linux, Shared tenancy)."""
    filters = [
        _term_match("instanceType", instance_type),
        _term_match("location", location),
        _term_match("operatingSystem", operating_system),
        _term_match("tenancy", "Shared"),
        _term_match("preInstalledSw", "NA"),
        _term_match("capacitystatus", "Used"),
    ]
    return get_price(SERVICE_EC2, filters)


def get_rds_hourly_price(
    engine: str = "PostgreSQL",
    instance_type: str = "db.t3.micro",
    location: str = "US East (N. Virginia)",
) -> Decimal | None:
    """RDS On-Demand saatlik fiyat."""
    filters = [
        _term_match("databaseEngine", engine),
        _term_match("instanceType", instance_type),
        _term_match("location", location),
        _term_match("deploymentOption", "Single-AZ"),
    ]
    return get_price(SERVICE_RDS, filters)


def get_s3_storage_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """S3 Standard Storage USD/GB-ay (ilk tier)."""
    return _select_price(
        SERVICE_S3,
        [_term_match("location", location)],
        lambda a: (a.get("usagetype") == "TimedStorage-ByteHrs" and a.get("storageClass") == "General Purpose"),
    )


def get_s3_requests_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """S3 API request Tier1 (PUT/COPY/POST/LIST) birim fiyatı."""
    return _select_price(
        SERVICE_S3,
        [_term_match("location", location)],
        lambda a: a.get("usagetype") == "Requests-Tier1",
    )


def get_cloudfront_price(
    usage_type: str = "US-DataTransfer-Out-Bytes",
) -> Decimal | None:
    """CloudFront data transfer USD/GB (usage type'a göre)."""
    filters = [_term_match("usagetype", usage_type)]
    return get_price(SERVICE_CLOUDFRONT, filters)


def get_route53_hosted_zone_price() -> Decimal | None:
    """Route53 hosted zone aylık fiyat."""
    filters = [_term_match("usagetype", "HostedZone")]
    return get_price(SERVICE_ROUTE53, filters)


def get_lambda_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """Lambda fiyat (genelde 1M istek başına)."""
    filters = [
        _term_match("location", location),
        _term_match("group", "AWS-Lambda-Requests"),
    ]
    return get_price(SERVICE_LAMBDA, filters)


def get_elasticache_hourly_price(
    cache_engine: str = "Redis",
    instance_type: str = "cache.t3.micro",
    location: str = "US East (N. Virginia)",
) -> Decimal | None:
    """ElastiCache On-Demand saatlik fiyat."""
    filters = [
        _term_match("cacheEngine", cache_engine),
        _term_match("instanceType", instance_type),
        _term_match("location", location),
    ]
    return get_price(SERVICE_ELASTICACHE, filters)


def get_secrets_manager_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """Secrets Manager secret aylık fiyat."""
    filters = [
        _term_match("location", location),
        _term_match("group", "AWSSecretsManager-Secret"),
    ]
    return get_price(SERVICE_SECRETS_MANAGER, filters)


def get_ses_price(
    location: str = "US East (N. Virginia)",
    usage_type: str = "Recipients",
) -> Decimal | None:
    """SES fiyat (örn. 1000 email)."""
    filters = [
        _term_match("location", location),
        _term_match("operation", "Send"),
        _term_match("usagetype", usage_type),
    ]
    return get_price(SERVICE_SES, filters)


def get_cloudwatch_metric_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """CloudWatch custom metric birim fiyatı."""
    filters = [
        _term_match("location", location),
        _term_match("usagetype", "CW:MetricMonitorUsage"),
    ]
    return get_price(SERVICE_CLOUDWATCH, filters)


def get_nat_gateway_hourly_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """NAT Gateway saatlik fiyatı."""
    return _select_price(
        SERVICE_EC2,
        [_term_match("location", location), _term_match("productFamily", "NAT Gateway")],
        lambda a: a.get("usagetype") in ("NatGateway-Hours", "RegionalNatGateway-Hours"),
    )


def get_elastic_ip_hourly_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """
    Elastic IP / Public IPv4 saatlik ücret.
    Öncelik: IdleAddress, fallback: InUseAddress.
    """
    return _select_price(
        SERVICE_VPC,
        [_term_match("location", location)],
        lambda a: a.get("usagetype") in ("USE1-PublicIPv4:IdleAddress", "USE1-PublicIPv4:InUseAddress"),
    )


def get_backup_s3_storage_price(location: str = "US East (N. Virginia)") -> Decimal | None:
    """AWS Backup - S3 warm storage GB-month fiyatı."""
    filters = [
        _term_match("location", location),
        _term_match("usagetype", "USE1-WarmStorage-ByteHrs-S3"),
    ]
    return get_price(SERVICE_BACKUP, filters)


def get_backup_rds_snapshot_price() -> Decimal | None:
    """RDS backup snapshot (charged backup usage) GB-ay fiyatı."""
    filters = [_term_match("usagetype", "RDS:ChargedBackupUsage")]
    return get_price(SERVICE_RDS, filters)


def get_bandwidth_data_transfer_price(
    from_location: str = "US East (N. Virginia)",
) -> Decimal | None:
    """
    İnternet çıkışı için Data Transfer birim fiyatı.
    Kural: AWSDataTransfer servisinde fromLocation=USE1, toLocation=External, usagetype=USE1-AWS-Out-Bytes.
    """
    primary_filters = [
        _term_match("fromLocation", from_location),
        _term_match("toLocation", "External"),
        _term_match("usagetype", "USE1-AWS-Out-Bytes"),
    ]
    price = get_price(SERVICE_DATA_TRANSFER, primary_filters)
    if price is not None:
        return price
    # Fallback: External internet çıkış adaylarından pozitif en düşük fiyatı seç.
    return _select_price(
        SERVICE_DATA_TRANSFER,
        [_term_match("fromLocation", from_location), _term_match("toLocation", "External")],
        lambda a: "Out-Bytes" in str(a.get("usagetype") or ""),
    )


def get_acm_private_ca_price() -> Decimal | None:
    """ACM Private CA aylık otorite maliyeti."""
    filters = [_term_match("group", "Certificate Authority Paid")]
    return get_price(SERVICE_ACM, filters)
