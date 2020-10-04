package fairlead.marketdata

uses fairlead.model.VenueId
uses fairlead.model.Side
uses fairlead.model.Quote
uses fairlead.model.PriceLevel
uses java.util.List
uses java.util.ArrayList
uses java.util.Random

/**
 * Deterministic market data replay and simulation engine generating high-fidelity multi-venue
 * quote feeds, order book depth distributions, volatility shocks, and microstructure anomalies.
 */
class MarketDataReplayEngine {
  var _feedHandler : MarketDataFeedHandler as FeedHandler
  var _random : Random
  var _currentSeq : long

  construct(handler : MarketDataFeedHandler, seed : long) {
    _feedHandler = handler
    _random = new Random(seed)
    _currentSeq = 1L
  }

  private function nextSeq() : long {
    var s = _currentSeq
    _currentSeq = _currentSeq + 1L
    return s
  }

  /**
   * Generates a balanced liquid multi-venue market state across Nasdaq, Nyse, Bats, Arca, and Edga.
   */
  public function generateLiquidMarket(symbol : String, midPriceDouble : double) : List<Quote> {
    var quotes = new ArrayList<Quote>()
    var venues = new VenueId[]{VenueId.NASDAQ, VenueId.NYSE, VenueId.BATS, VenueId.ARCA, VenueId.EDGX, VenueId.EDGA}
    var baseMid = PriceLevel.fromDouble(midPriceDouble)

    for (v in venues) {
      // Small jitter around 1-2 cents spread
      var spread = (100L + (_random.nextInt(2) * 100L)) // 1 or 2 cents
      var bid = baseMid - (spread / 2L)
      var ask = bid + spread
      var bidQty = 500L + (_random.nextInt(15) * 100L)
      var askQty = 500L + (_random.nextInt(15) * 100L)
      var timeNs = java.lang.System.nanoTime()

      var seq = nextSeq()
      var q = new Quote(v, symbol, bid, bidQty, ask, askQty, timeNs, seq)
      _feedHandler.onQuotePacket(q)
      quotes.add(q)
    }
    return quotes
  }

  /**
   * Simulates a deep multi-level order book ladder across 5 price levels for a given venue.
   */
  public function populateDeepBook(venue : VenueId, symbol : String, midPriceDouble : double, levels : int) {
    var baseMid = PriceLevel.fromDouble(midPriceDouble)
    var timeNs = java.lang.System.nanoTime()

    for (i in 1..levels) {
      var offset = (i as long) * 100L // 1 cent increments
      var bidPx = baseMid - offset
      var askPx = baseMid + offset
      var bidQty = (1000L * (i as long)) + (_random.nextInt(10) * 100L)
      var askQty = (1000L * (i as long)) + (_random.nextInt(10) * 100L)

      var seqBid = nextSeq()
      _feedHandler.onDepthUpdate(venue, symbol, Side.BUY, bidPx, bidQty, i, timeNs, seqBid)
      var seqAsk = nextSeq()
      _feedHandler.onDepthUpdate(venue, symbol, Side.SELL, askPx, askQty, i, timeNs, seqAsk)
    }
  }

  /**
   * Generates a transient crossed market anomaly where a venue bid crosses another venue ask.
   */
  public function injectCrossedMarketAnomaly(symbol : String, midPriceDouble : double) : Quote {
    var baseMid = PriceLevel.fromDouble(midPriceDouble)
    var aggressiveBid = baseMid + 200L // 2 cents above midpoint
    var timeNs = java.lang.System.nanoTime()
    var seq = nextSeq()
    var crossedQuote = new Quote(VenueId.BATS, symbol, aggressiveBid, 800L, aggressiveBid + 100L, 500L, timeNs, seq)
    _feedHandler.onQuotePacket(crossedQuote)
    return crossedQuote
  }

  /**
   * Injects an inverted venue quote on EDGA with aggressive pricing to trigger maker-taker rebate routing.
   */
  public function injectInvertedRebateOpportunity(symbol : String, midPriceDouble : double) : Quote {
    var baseMid = PriceLevel.fromDouble(midPriceDouble)
    var timeNs = java.lang.System.nanoTime()
    var seq = nextSeq()
    // EDGA joins best ask, providing taker rebate
    var edgaQuote = new Quote(VenueId.EDGA, symbol, baseMid - 100L, 1000L, baseMid, 1500L, timeNs, seq)
    _feedHandler.onQuotePacket(edgaQuote)
    return edgaQuote
  }
}
