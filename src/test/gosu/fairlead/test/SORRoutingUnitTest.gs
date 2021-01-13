package fairlead.test

uses fairlead.sor.RegNMSProtectedQuoteRouter
uses fairlead.sor.DepthOfBookSweepRouter
uses fairlead.sor.CostAwareRouter
uses fairlead.sor.DarkPoolProbingRouter
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
 * Unit and invariant test suite verifying Smart Order Routing strategies under Reg NMS Rule 611,
 * Depth-of-Book sweeps, cost-optimized rebate harvesting, and dark pool probing.
 */
class SORRoutingUnitTest {
  public static function run() : boolean {
    print("  -> Running SORRoutingUnitTest...")
    testRegNMSRule611Protection()
    testDepthOfBookMultiLevelSweep()
    testCostAwareRebateHarvesting()
    testDarkPoolProbingMinFill()
    return true
  }

  private static function testRegNMSRule611Protection() {
    var router = new RegNMSProtectedQuoteRouter(null)
    var nbbo = new NBBO("AAPL", PriceLevel.fromDouble(180.00), 1000L, Arrays.asList({VenueId.NASDAQ}),
                        PriceLevel.fromDouble(180.05), 1500L, Arrays.asList({VenueId.NASDAQ, VenueId.BATS}), System.nanoTime(), 1L)

    var books = new HashMap<VenueId, OrderBookLevel2>()
    var nasd = new OrderBookLevel2(VenueId.NASDAQ, "AAPL")
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(180.05), 1000L, 1, System.nanoTime(), 1L)
    var bats = new OrderBookLevel2(VenueId.BATS, "AAPL")
    bats.updateLevel(Side.SELL, PriceLevel.fromDouble(180.05), 500L, 1, System.nanoTime(), 2L)
    books.put(VenueId.NASDAQ, nasd)
    books.put(VenueId.BATS, bats)

    var o = new Order("O1", "C1", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.10), 1200L, "ACC1", "T1", "REG_NMS")
    var plan = router.route(o, nbbo, books)

    assert plan.Allocations.size() == 2 : "Must allocate across both protected venues"
    assert plan.TotalAllocatedQuantity == 1200L : "Total allocated must equal 1200"
    assert plan.Allocations.get(0).Venue == VenueId.NASDAQ : "First allocation to Nasdaq"
    assert plan.Allocations.get(0).SlicedQuantity == 1000L : "Nasdaq slice must be 1000"
    assert plan.Allocations.get(1).Venue == VenueId.BATS : "Second allocation to BATS"
    assert plan.Allocations.get(1).SlicedQuantity == 200L : "BATS slice must be 200"
  }

  private static function testDepthOfBookMultiLevelSweep() {
    var router = new DepthOfBookSweepRouter(null)
    var books = new HashMap<VenueId, OrderBookLevel2>()

    var nasd = new OrderBookLevel2(VenueId.NASDAQ, "TSLA")
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(200.00), 500L, 1, System.nanoTime(), 1L)
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(200.02), 1000L, 2, System.nanoTime(), 2L)

    var bats = new OrderBookLevel2(VenueId.BATS, "TSLA")
    bats.updateLevel(Side.SELL, PriceLevel.fromDouble(200.00), 500L, 1, System.nanoTime(), 3L)
    bats.updateLevel(Side.SELL, PriceLevel.fromDouble(200.01), 800L, 2, System.nanoTime(), 4L)

    books.put(VenueId.NASDAQ, nasd)
    books.put(VenueId.BATS, bats)

    var o = new Order("O2", "C2", "TSLA", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(200.05), 2000L, "ACC1", "T1", "SWEEP")
    var plan = router.route(o, null, books)

    assert plan.TotalAllocatedQuantity == 2000L : "Sweep must allocate full 2000 shares"
    assert plan.Allocations.size() == 3 : "Must slice across 3 levels/venues"
    // First 1000 shares @ 200.00 (500 BATS + 500 NASDAQ)
    // Next 800 shares @ 200.01 (BATS)
    // Remaining 200 shares @ 200.02 (NASDAQ)
    assert plan.Allocations.get(0).TargetPrice == PriceLevel.fromDouble(200.00) : "First slice @ 200.00"
    assert plan.Allocations.get(1).TargetPrice == PriceLevel.fromDouble(200.00) : "Second slice @ 200.00"
    assert plan.Allocations.get(2).TargetPrice == PriceLevel.fromDouble(200.01) : "Third slice @ 200.01"
  }

  private static function testCostAwareRebateHarvesting() {
    var router = new CostAwareRouter(null)
    var books = new HashMap<VenueId, OrderBookLevel2>()

    // EDGA (inverted venue) ask 100.00 -> -$0.0018 rebate
    var edga = new OrderBookLevel2(VenueId.EDGA, "SPY")
    edga.updateLevel(Side.SELL, PriceLevel.fromDouble(100.00), 1000L, 1, System.nanoTime(), 1L)

    // NASDAQ ask 100.00 -> +$0.0030 fee
    var nasd = new OrderBookLevel2(VenueId.NASDAQ, "SPY")
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(100.00), 1000L, 1, System.nanoTime(), 2L)

    books.put(VenueId.EDGA, edga)
    books.put(VenueId.NASDAQ, nasd)

    var o = new Order("O3", "C3", "SPY", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(100.00), 1500L, "ACC1", "T1", "COST")
    var plan = router.route(o, null, books)

    assert plan.Allocations.get(0).Venue == VenueId.EDGA : "Inverted venue EDGA must be routed first"
    assert plan.Allocations.get(0).SlicedQuantity == 1000L : "EDGA gets full 1000 shares"
    assert plan.Allocations.get(0).ExpectedFeeOrRebate < 0.0 : "EDGA expected fee must be a rebate credit"
    assert plan.Allocations.get(1).Venue == VenueId.NASDAQ : "NASDAQ gets remainder 500 shares"
  }

  private static function testDarkPoolProbingMinFill() {
    var router = new DarkPoolProbingRouter(null, 500L)
    var nbbo = new NBBO("MSFT", PriceLevel.fromDouble(400.00), 1000L, Arrays.asList({VenueId.NASDAQ}),
                        PriceLevel.fromDouble(400.10), 1000L, Arrays.asList({VenueId.NASDAQ}), System.nanoTime(), 1L)

    var largeOrder = new Order("O4", "C4", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(400.08), 2000L, "ACC1", "T1", "DARK")
    var smallOrder = new Order("O5", "C5", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(400.08), 300L, "ACC1", "T1", "DARK")

    var largePlan = router.route(largeOrder, nbbo, null)
    var smallPlan = router.route(smallOrder, nbbo, null)

    assert largePlan.TotalAllocatedQuantity == 2000L : "Large order must be routed to dark pool"
    assert largePlan.Allocations.get(0).TargetPrice == nbbo.Midpoint : "Dark probe must target NBBO midpoint"
    assert smallPlan.TotalAllocatedQuantity == 0L : "Small order below 500 shares minimum must not probe dark pool"
  }
}
