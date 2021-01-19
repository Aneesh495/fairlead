package fairlead.bench

uses fairlead.sor.SmartOrderRouterRegistry
uses fairlead.risk.RiskGate
uses fairlead.risk.MaxOrderSizeFilter
uses fairlead.risk.MaxOrderNotionalFilter
uses fairlead.risk.PriceCollarFilter
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses fairlead.model.NBBO
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Arrays
uses java.util.HashMap

/**
 * Microbenchmark measuring end-to-end Smart Order Routing throughput (orders/sec)
 * including SEC Rule 15c3-5 risk gate evaluation and multi-venue depth slicing.
 */
class RouterThroughputBench {
  public static function run(iterations : int) {
    var gate = new RiskGate()
    gate.addFilter(new MaxOrderSizeFilter(50000L))
    gate.addFilter(new MaxOrderNotionalFilter(5000000.0))
    gate.addFilter(new PriceCollarFilter(0.05))

    var registry = new SmartOrderRouterRegistry(gate, null)

    var nbbo = new NBBO("SPY", PriceLevel.fromDouble(500.00), 5000L, Arrays.asList({VenueId.NASDAQ, VenueId.BATS}),
                        PriceLevel.fromDouble(500.02), 5000L, Arrays.asList({VenueId.NYSE, VenueId.ARCA}), System.nanoTime(), 1L)

    var books = new HashMap<VenueId, OrderBookLevel2>()
    var nasd = new OrderBookLevel2(VenueId.NASDAQ, "SPY")
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(500.02), 3000L, 2, System.nanoTime(), 1L)
    var bats = new OrderBookLevel2(VenueId.BATS, "SPY")
    bats.updateLevel(Side.SELL, PriceLevel.fromDouble(500.02), 2000L, 1, System.nanoTime(), 2L)
    books.put(VenueId.NASDAQ, nasd)
    books.put(VenueId.BATS, bats)

    // Warm-up JIT
    for (i in 1..5000) {
      var o = new Order("W" + i, "CW" + i, "SPY", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(500.02), 500L, "ACC", "TR", "BENCH")
      registry.routeOrder(o, nbbo, books, "DEPTH_OF_BOOK_SWEEP")
    }

    var startNs = java.lang.System.nanoTime()

    for (i in 1..iterations) {
      var o = new Order("O" + i, "C" + i, "SPY", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(500.02), 1000L, "ACC", "TR", "BENCH")
      registry.routeOrder(o, nbbo, books, "DEPTH_OF_BOOK_SWEEP")
    }

    var durationNs = java.lang.System.nanoTime() - startNs
    var durationSec = (durationNs as double) / 1000000000.0
    var opsPerSec = (iterations as double) / durationSec
    var avgLatencyNs = (durationNs as double) / (iterations as double)

    print("  [BENCH] Router Throughput: " + java.lang.String.format("%,.0f", new Object[]{opsPerSec}) +
          " orders/sec | Avg latency: " + java.lang.String.format("%.1f", new Object[]{avgLatencyNs}) + " ns/order")
  }
}
