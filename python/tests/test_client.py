import unittest
from fairlead.models import Order, Quote, NBBO
from fairlead.scenarios import MarketScenarios

class TestFairleadClientSDK(unittest.TestCase):
    def test_order_creation_and_defaults(self):
        o = Order(
            order_id="ORD-001",
            client_order_id="CL-001",
            symbol="NVDA",
            side="BUY",
            order_type="LIMIT",
            quantity=1500,
            limit_price=125.50
        )
        self.assertEqual(o.leaves_quantity, 1500)
        self.assertEqual(o.cum_quantity, 0)
        self.assertEqual(o.status, "NEW")

    def test_quote_spread_and_midpoint(self):
        q = Quote(
            venue="NASDAQ",
            symbol="MSFT",
            bid_price=410.10,
            bid_size=500,
            ask_price=410.12,
            ask_size=600
        )
        self.assertAlmostEqual(q.spread, 0.02, places=4)
        self.assertAlmostEqual(q.midpoint, 410.11, places=4)

    def test_scenario_synthesis(self):
        quotes = MarketScenarios.create_liquid_equities_quote_set("AAPL", 180.00)
        nbbo = MarketScenarios.synthesize_nbbo(quotes)

        self.assertAlmostEqual(nbbo.best_bid_price, 179.99, places=2)
        self.assertAlmostEqual(nbbo.best_ask_price, 180.01, places=2)
        self.assertFalse(nbbo.is_locked)
        self.assertFalse(nbbo.is_crossed)
        self.assertIn("NASDAQ", nbbo.best_bid_venues)
        self.assertIn("BATS", nbbo.best_bid_venues)
        self.assertIn("EDGA", nbbo.best_bid_venues)

if __name__ == "__main__":
    unittest.main()
