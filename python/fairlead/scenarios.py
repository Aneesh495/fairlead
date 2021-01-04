"""
Market scenario generators for simulating multi-venue liquidity conditions.
"""

from typing import List
from .models import Quote, NBBO

class MarketScenarios:
    @staticmethod
    def create_liquid_equities_quote_set(symbol: str = "AAPL", base_mid: float = 180.00) -> List[Quote]:
        return [
            Quote(venue="NASDAQ", symbol=symbol, bid_price=base_mid - 0.01, bid_size=1500, ask_price=base_mid + 0.01, ask_size=1200),
            Quote(venue="BATS", symbol=symbol, bid_price=base_mid - 0.01, bid_size=800, ask_price=base_mid + 0.01, ask_size=900),
            Quote(venue="NYSE", symbol=symbol, bid_price=base_mid - 0.02, bid_size=2000, ask_price=base_mid + 0.02, ask_size=2500),
            Quote(venue="ARCA", symbol=symbol, bid_price=base_mid - 0.02, bid_size=1100, ask_price=base_mid + 0.01, ask_size=700),
            Quote(venue="EDGA", symbol=symbol, bid_price=base_mid - 0.01, bid_size=600, ask_price=base_mid + 0.01, ask_size=800),
        ]

    @staticmethod
    def synthesize_nbbo(quotes: List[Quote]) -> NBBO:
        if not quotes:
            raise ValueError("Quotes list cannot be empty")

        symbol = quotes[0].symbol
        max_bid = max(q.bid_price for q in quotes)
        min_ask = min(q.ask_price for q in quotes)

        bid_venues = [q.venue for q in quotes if q.bid_price == max_bid]
        ask_venues = [q.venue for q in quotes if q.ask_price == min_ask]

        total_bid_size = sum(q.bid_size for q in quotes if q.bid_price == max_bid)
        total_ask_size = sum(q.ask_size for q in quotes if q.ask_price == min_ask)

        return NBBO(
            symbol=symbol,
            best_bid_price=max_bid,
            best_bid_size=total_bid_size,
            best_bid_venues=bid_venues,
            best_ask_price=min_ask,
            best_ask_size=total_ask_size,
            best_ask_venues=ask_venues
        )
