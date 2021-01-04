"""
Domain data models for Fairlead trading entities, quotes, and execution allocations.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import time

@dataclass
class Quote:
    venue: str
    symbol: str
    bid_price: float
    bid_size: int
    ask_price: float
    ask_size: int
    timestamp_ns: int = field(default_factory=time.time_ns)

    @property
    def spread(self) -> float:
        return self.ask_price - self.bid_price

    @property
    def midpoint(self) -> float:
        return (self.bid_price + self.ask_price) / 2.0

@dataclass
class NBBO:
    symbol: str
    best_bid_price: float
    best_bid_size: int
    best_bid_venues: List[str]
    best_ask_price: float
    best_ask_size: int
    best_ask_venues: List[str]
    timestamp_ns: int = field(default_factory=time.time_ns)

    @property
    def spread(self) -> float:
        return self.best_ask_price - self.best_bid_price

    @property
    def midpoint(self) -> float:
        return (self.best_bid_price + self.best_ask_price) / 2.0

    @property
    def is_locked(self) -> bool:
        return self.best_bid_price == self.best_ask_price and self.best_bid_price > 0.0

    @property
    def is_crossed(self) -> bool:
        return self.best_bid_price > self.best_ask_price and self.best_ask_price > 0.0

@dataclass
class FillAllocation:
    venue: str
    sliced_quantity: int
    target_price: float
    expected_fee: float
    strategy_tag: str
    route_priority: int
    latency_micros: int

@dataclass
class Order:
    order_id: str
    client_order_id: str
    symbol: str
    side: str
    order_type: str
    quantity: int
    limit_price: float = 0.0
    leaves_quantity: int = 0
    cum_quantity: int = 0
    avg_price: float = 0.0
    status: str = "NEW"
    account: str = "DEFAULT"
    trader_id: str = "SYSTEM"
    strategy_tag: str = "SOR_SWEEP"

    def __post_init__(self):
        if self.leaves_quantity == 0 and self.cum_quantity == 0:
            self.leaves_quantity = self.quantity

@dataclass
class ExecutionReport:
    exec_id: str
    order_id: str
    symbol: str
    side: str
    last_shares: int
    last_price: float
    cum_shares: int
    leaves_shares: int
    avg_price: float
    status: str
    venue: str
    liquidity_flag: str
    fee_or_rebate: float
    text: str = ""
