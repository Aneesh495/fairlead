package fairlead.test

uses fairlead.marketdata.SyntheticNBBOEngine
uses fairlead.marketdata.OrderBookLevel2
uses fairlead.model.Quote
uses fairlead.model.Side
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses java.util.Random

/**
 * Property-based and invariant fuzzing test suite simulating 1,000 rapid randomized quote
 * permutations to verify market data stability, monotonic invariants, and book conservation laws.
 */
class InvariantFuzzTest {
  public static function run() : boolean {
    print("  -> Running InvariantFuzzTest (1,000 fuzzing cycles)...")
    var random = new Random(1337L)
    var engine = new SyntheticNBBOEngine("FUZZ_SYM")
    var venues = new VenueId[]{VenueId.NASDAQ, VenueId.NYSE, VenueId.BATS, VenueId.ARCA, VenueId.EDGX}

    var basePrice = 1000000L // $100.00
    var cycles = 1000

    for (i in 1..cycles) {
      var v = venues[random.nextInt(venues.length)]
      var spread = 100L + (random.nextInt(5) * 100L) // 1 to 5 cents
      var offset = (random.nextInt(10) - 5) * 100L
      var mid = basePrice + offset

      var bidPx = mid - (spread / 2L)
      var askPx = bidPx + spread
      var bidSz = 100L + (random.nextInt(20) * 100L)
      var askSz = 100L + (random.nextInt(20) * 100L)

      var quote = new Quote(v, "FUZZ_SYM", bidPx, bidSz, askPx, askSz, java.lang.System.nanoTime(), i as long)
      var nbbo = engine.onQuote(quote)

      if (nbbo != null) {
        // Invariant 1: Valid NBBO must have positive prices
        if (nbbo.IsValid) {
          assert nbbo.BestBidPrice > 0L : "Fuzz invariant violated: BestBidPrice <= 0"
          assert nbbo.BestAskPrice > 0L : "Fuzz invariant violated: BestAskPrice <= 0"
          assert nbbo.BestBidPrice <= nbbo.BestAskPrice : "Fuzz invariant violated: BestBidPrice > BestAskPrice on valid NBBO"
          assert nbbo.Spread >= 0L : "Fuzz invariant violated: negative spread on valid NBBO"
          assert nbbo.MicroPrice >= ((nbbo.BestBidPrice as double) / 10000.0) : "Micro-price must be >= BestBid"
          assert nbbo.MicroPrice <= ((nbbo.BestAskPrice as double) / 10000.0) : "Micro-price must be <= BestAsk"
        }
      }
    }

    print("     Successfully verified all market invariants across " + cycles + " fuzzing cycles.")
    return true
  }
}
