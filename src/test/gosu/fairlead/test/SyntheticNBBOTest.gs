package fairlead.test

uses fairlead.marketdata.SyntheticNBBOEngine
uses fairlead.marketdata.MarketDataFeedHandler
uses fairlead.model.Quote
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel

/**
 * Unit and property test suite verifying synthetic NBBO reconstruction, multi-venue tie priority,
 * and locked/crossed market anomaly detection.
 */
class SyntheticNBBOTest {
  public static function run() : boolean {
    print("  -> Running SyntheticNBBOTest...")
    testStandardNBBOAggregation()
    testMultiVenueTieResolution()
    testLockedMarketDetection()
    testCrossedMarketDetection()
    return true
  }

  private static function testStandardNBBOAggregation() {
    var engine = new SyntheticNBBOEngine("AAPL")
    var now = java.lang.System.nanoTime()

    engine.onQuote(new Quote(VenueId.NASDAQ, "AAPL", PriceLevel.fromDouble(150.00), 500L, PriceLevel.fromDouble(150.02), 400L, now, 1L))
    engine.onQuote(new Quote(VenueId.NYSE, "AAPL", PriceLevel.fromDouble(149.99), 1000L, PriceLevel.fromDouble(150.03), 800L, now, 2L))

    var nbbo = engine.CurrentNBBO
    assert nbbo != null : "NBBO must not be null"
    assert nbbo.BestBidPrice == PriceLevel.fromDouble(150.00) : "Best bid must be 150.00"
    assert nbbo.BestAskPrice == PriceLevel.fromDouble(150.02) : "Best ask must be 150.02"
    assert nbbo.BestBidSize == 500L : "Best bid size must be 500"
    assert nbbo.BestAskSize == 400L : "Best ask size must be 400"
    assert nbbo.Spread == 200L : "Spread must be 2 cents (200 units)"
  }

  private static function testMultiVenueTieResolution() {
    var engine = new SyntheticNBBOEngine("GOOG")
    var now = java.lang.System.nanoTime()

    engine.onQuote(new Quote(VenueId.NASDAQ, "GOOG", PriceLevel.fromDouble(175.00), 800L, PriceLevel.fromDouble(175.05), 1000L, now, 1L))
    engine.onQuote(new Quote(VenueId.BATS, "GOOG", PriceLevel.fromDouble(175.00), 1200L, PriceLevel.fromDouble(175.05), 500L, now, 2L))

    var nbbo = engine.CurrentNBBO
    assert nbbo.BestBidSize == 2000L : "Best bid size must combine Nasdaq and BATS (2000 shares)"
    assert nbbo.BestAskSize == 1500L : "Best ask size must combine Nasdaq and BATS (1500 shares)"
    assert nbbo.BestBidVenues.contains(VenueId.NASDAQ) : "Must contain Nasdaq on bid"
    assert nbbo.BestBidVenues.contains(VenueId.BATS) : "Must contain BATS on bid"
  }

  private static function testLockedMarketDetection() {
    var engine = new SyntheticNBBOEngine("MSFT")
    var now = java.lang.System.nanoTime()

    // Nasdaq bid 400.00 x ask 400.02
    engine.onQuote(new Quote(VenueId.NASDAQ, "MSFT", PriceLevel.fromDouble(400.00), 500L, PriceLevel.fromDouble(400.02), 500L, now, 1L))
    // BATS bid 400.02 x ask 400.04 -> BATS bid locks Nasdaq ask!
    engine.onQuote(new Quote(VenueId.BATS, "MSFT", PriceLevel.fromDouble(400.02), 700L, PriceLevel.fromDouble(400.04), 700L, now, 2L))

    var nbbo = engine.CurrentNBBO
    assert nbbo.IsLocked : "Market must be flagged as locked (Bid 400.02 == Ask 400.02)"
    assert !nbbo.IsCrossed : "Locked market is not crossed"
    assert engine.LockedMarketCount > 0L : "Locked count must increment"
  }

  private static function testCrossedMarketDetection() {
    var engine = new SyntheticNBBOEngine("TSLA")
    var now = java.lang.System.nanoTime()

    // Nasdaq ask 200.00
    engine.onQuote(new Quote(VenueId.NASDAQ, "TSLA", PriceLevel.fromDouble(199.98), 500L, PriceLevel.fromDouble(200.00), 500L, now, 1L))
    // BATS bid 200.02 -> BATS bid crosses Nasdaq ask by 2 cents!
    engine.onQuote(new Quote(VenueId.BATS, "TSLA", PriceLevel.fromDouble(200.02), 800L, PriceLevel.fromDouble(200.05), 500L, now, 2L))

    var nbbo = engine.CurrentNBBO
    assert nbbo.IsCrossed : "Market must be flagged as crossed (Bid 200.02 > Ask 200.00)"
    assert !nbbo.IsValid : "Crossed market cannot be valid"
    assert engine.CrossedMarketCount > 0L : "Crossed count must increment"
  }
}
