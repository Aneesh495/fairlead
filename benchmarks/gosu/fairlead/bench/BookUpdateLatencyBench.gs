package fairlead.bench

uses fairlead.marketdata.SyntheticNBBOEngine
uses fairlead.model.Quote
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses java.util.Arrays

/**
 * Microbenchmark measuring quote ingestion and synthetic NBBO recalculation latency.
 */
class BookUpdateLatencyBench {
  public static function run(iterations : int) {
    var engine = new SyntheticNBBOEngine("NVDA")
    var venues = new VenueId[]{VenueId.NASDAQ, VenueId.NYSE, VenueId.BATS, VenueId.ARCA, VenueId.EDGX}

    // Warm-up JIT
    for (i in 1..5000) {
      var v = venues[i % venues.length]
      var q = new Quote(v, "NVDA", PriceLevel.fromDouble(120.00), 500L, PriceLevel.fromDouble(120.02), 500L, System.nanoTime(), i as long)
      engine.onQuote(q)
    }

    var latencies = new long[iterations]

    for (i in 0..(iterations - 1)) {
      var v = venues[i % venues.length]
      var q = new Quote(v, "NVDA", PriceLevel.fromDouble(120.00 + ((i % 10) as double)*0.01), 500L,
                              PriceLevel.fromDouble(120.02 + ((i % 10) as double)*0.01), 500L, System.nanoTime(), (i + 1) as long)

      var t0 = java.lang.System.nanoTime()
      engine.onQuote(q)
      var t1 = java.lang.System.nanoTime()
      latencies[i] = t1 - t0
    }

    Arrays.sort(latencies)
    var p50 = latencies[(iterations as double * 0.50) as int]
    var p90 = latencies[(iterations as double * 0.90) as int]
    var p99 = latencies[(iterations as double * 0.99) as int]

    print("  [BENCH] NBBO Engine Latency: p50=" + p50 + " ns | p90=" + p90 + " ns | p99=" + p99 + " ns across " +
          iterations + " quote ticks")
  }
}
