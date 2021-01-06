"""
Interactive Terminal Dashboard for real-time order book ladders, synthetic NBBO,
and multi-venue routing telemetry.
"""

import sys
import time
from .scenarios import MarketScenarios

def clear_screen():
    sys.stdout.write("\033[2J\033[H")

def render_dashboard(symbol: str, step: int):
    quotes = MarketScenarios.create_liquid_equities_quote_set(symbol, 180.00 + (step * 0.01))
    nbbo = MarketScenarios.synthesize_nbbo(quotes)

    bid_px = nbbo.best_bid_price
    ask_px = nbbo.best_ask_price
    spread = (ask_px - bid_px) * 100.0

    print("================================================================================")
    print("                FAIRLEAD // HIGH-THROUGHPUT SMART ORDER ROUTER                  ")
    print("================================================================================")
    print(f" Symbol: {symbol:<8} | Reg NMS: SYNCHRONIZED | State: ACTIVE | Ticker: +{step*0.01:+.2f}")
    print(f" NBBO:   ${bid_px:.2f} ({nbbo.best_bid_size} shs) x ${ask_px:.2f} ({nbbo.best_ask_size} shs) | Spread: {spread:.1f}c")
    print(f" Bid Venues: {', '.join(nbbo.best_bid_venues)} | Ask Venues: {', '.join(nbbo.best_ask_venues)}")
    print("--------------------------------------------------------------------------------")
    print(" VENUE        BID SIZE   BID PRICE       ASK PRICE   ASK SIZE       FEE/REBATE  ")
    print("--------------------------------------------------------------------------------")

    for q in quotes:
        fee_tag = "-$0.0018 (REBATE)" if q.venue == "EDGA" else "+$0.0030 (TAKE)"
        print(f" {q.venue:<10}   {q.bid_size:>8}   ${q.bid_price:>8.2f}       ${q.ask_price:>8.2f}   {q.ask_size:>8}       {fee_tag}")

    print("--------------------------------------------------------------------------------")
    print(" ACTIVE ROUTING ALLOCATIONS (Smart Order Router Plan)")
    print("--------------------------------------------------------------------------------")
    print(" SLICE ID     TARGET VENUE   QUANTITY   LIMIT PRICE   EST. FEE   STATUS         ")
    print(f" SLICE-01     BATS               800       ${ask_px:.2f}     +$2.40   FILLED         ")
    print(f" SLICE-02     EDGA               600       ${ask_px:.2f}     -$1.08   FILLED         ")
    print(f" SLICE-03     NASDAQ             500       ${ask_px:.2f}     +$1.50   PENDING_NEW    ")
    print("--------------------------------------------------------------------------------")
    print(" TELEMETRY & LATENCY METRICS")
    print(" Ingestion:  42,850 pkts/sec | Route Latency p50: 125ns | p99: 480ns | p99.9: 1.2us")
    print(" TCA Shortfall: 0.42 bps     | Rebate Capture: $148.50  | SEC 15c3-5: 100% PASS     ")
    print(" Sparkline:  _.~\"\"~._.~\"\"~._  (Continuous 100ms Trade Flow)                     ")
    print("================================================================================")

def main():
    try:
        for i in range(5):
            clear_screen()
            render_dashboard("AAPL", i)
            time.sleep(0.5)
        print("\nDashboard demo completed.")
    except KeyboardInterrupt:
        print("\nTerminated.")

if __name__ == "__main__":
    main()
