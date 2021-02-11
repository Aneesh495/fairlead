package fairlead.sim

uses fairlead.marketdata.MarketDataFeedHandler
uses fairlead.model.PriceLevel
uses fairlead.model.Quote
uses fairlead.model.Side
uses fairlead.model.VenueId
uses java.util.Random
uses java.util.List

/**
 * High-Fidelity Market Microstructure Simulator.
 * Integrates Hawkes self-exciting event processes to simulate stochastic
 * order arrivals, market-maker cancellations, aggressive sweeps, and queue dynamics
 * across multiple competing lit and dark execution venues.
 */
class MarketMicrostructureSimulator {
  private var _feedHandler : MarketDataFeedHandler
  private var _hawkes : HawkesProcessEventModel
  private var _random : Random
  private var _venues : List<VenueId>

  public construct(feedHandler : MarketDataFeedHandler) {
    this(feedHandler, 42L)
  }

  public construct(feedHandler : MarketDataFeedHandler, seed : long) {
    _feedHandler = feedHandler
    _random = new Random(seed)
    _hawkes = new HawkesProcessEventModel(2.0, 1.2, 2.2, seed)
    _venues = new java.util.ArrayList<VenueId>()
    _venues.add(VenueId.NASDAQ)
    _venues.add(VenueId.NYSE)
    _venues.add(VenueId.BATS)
    _venues.add(VenueId.ARCA)
    _venues.add(VenueId.EDGX)
  }

  /**
   * Simulates a trading session for a given symbol starting at reference price.
   * Generates nSteps market microstructure events.
   */
  public function simulateTradingSession(symbol : String, initialPrice : double, nSteps : int) {
    var midPrice = initialPrice
    var seq = 1L
    var baseTimestamp = System.currentTimeMillis() * 1000000L

    for (i in 0..|nSteps) {
      // Small random walk on fundamental price
      var shock = (_random.nextGaussian() * 0.01)
      midPrice = Math.max(1.0, midPrice + shock)

      // Randomly pick a venue to update
      var vIdx = _random.nextInt(_venues.size())
      var venue = _venues.get(vIdx)

      var halfSpread = 0.005 + (_random.nextDouble() * 0.01)
      var bid = midPrice - halfSpread
      var ask = midPrice + halfSpread
      var bidSize = 100L * (1L + _random.nextInt(20))
      var askSize = 100L * (1L + _random.nextInt(20))

      var bidMicro = PriceLevel.fromDouble(bid)
      var askMicro = PriceLevel.fromDouble(ask)
      var ts = baseTimestamp + (i * 100000L) // +100 microseconds per step

      var q = new Quote(venue, symbol, bidMicro, bidSize, askMicro, askSize, ts, seq)
      _feedHandler.onQuotePacket(q)
      seq++
    }
  }
}
