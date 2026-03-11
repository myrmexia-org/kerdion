"""
TCMB döviz kuru servisi. today.xml üzerinden USD/TRY (ForexSelling) okunur.
"""
import xml.etree.ElementTree as ET

import requests

TCMB_TODAY_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"

# TCMB sunucusu User-Agent olmadan isteği reddedebilir (403)
TCMB_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/xml, text/xml, */*",
}


def get_usd_try(timeout: int = 10) -> float | None:
    """
    TCMB günlük kur dosyasından USD alış (ForexSelling) kurunu döndürür.
    Hata veya USD bulunamazsa None.
    """
    try:
        resp = requests.get(TCMB_TODAY_URL, headers=TCMB_HEADERS, timeout=timeout)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        for currency in root.findall("Currency"):
            if currency.get("CurrencyCode") == "USD":
                node = currency.find("ForexSelling")
                if node is not None and node.text:
                    return float(node.text.replace(",", "."))
    except Exception:
        pass
    return None
