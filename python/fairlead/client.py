"""
Client interface for interacting with the Fairlead Smart Order Router daemon.
"""

import urllib.request
import json
from typing import Dict, Any, Optional

class FairleadClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8080):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"

    def get_health(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/health"
        req = urllib.request.Request(url, headers={"User-Agent": "Fairlead-Python/0.1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def get_stats(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/stats"
        req = urllib.request.Request(url, headers={"User-Agent": "Fairlead-Python/0.1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def submit_order(self, symbol: str, side: str, quantity: int,
                     limit_price: float, strategy: str = "DEPTH_OF_BOOK_SWEEP") -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/orders"
        payload = json.dumps({
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "limit_price": limit_price,
            "strategy": strategy
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "Fairlead-Python/0.1.0"
        })
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
