package fairlead.test

uses fairlead.marketdata.SyntheticNBBOEngine
uses fairlead.risk.PriceCollarFilter
uses fairlead.risk.SelfMatchPreventionFilter
uses fairlead.sor.RegNMSProtectedQuoteRouter
uses fairlead.algo.TWAPExecutionEngine
uses fairlead.algo.ExecutionProgress
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.Quote
uses fairlead.model.VenueId
uses fairlead.model.NBBO
uses java.util.Arrays

/**
 * Regression bug test suite documenting and preventing reintroduction of edge-case bugs
 * encountered during engine architecture and stress testing.
 */
class RegressionBugSuiteTest {
  public static function run() : boolean {
    print("  -> Running RegressionBugSuiteTest (5 documented regression scenarios)...")
    testBug001_CrossedMarketBidAskInversion()
    testBug002_Rule612SubPennyTruncation()
    testBug003_TWAPZeroIntervalDivisionGuard()
    testBug004_SelfMatchAccountIsolation()
    testBug005_UnallocatedRemainderOnPartialVenueCapacity()
    return true
  }

  /**
   * Bug 001: Transient crossed quote across two venues must not corrupt NBBO spread into negative.
   */
  private static function testBug001_CrossedMarketBidAskInversion() {
    var engine = new SyntheticNBBOEngine("AAPL")
    var now = java.lang.System.nanoTime()

    engine.onQuote(new Quote(VenueId.NASDAQ, "AAPL", PriceLevel.fromDouble(150.00), 500L, PriceLevel.fromDouble(150.02), 500L, now, 1L))
    // BATS bid crosses Nasdaq ask
    engine.onQuote(new Quote(VenueId.BATS, "AAPL", PriceLevel.fromDouble(150.04), 500L, PriceLevel.fromDouble(150.06), 500L, now, 2L))

    var nbbo = engine.CurrentNBBO
    assert nbbo.IsCrossed : "Bug 001 Regression: NBBO must identify crossed market state"
    assert !nbbo.IsValid : "Bug 001 Regression: Crossed market must be marked invalid"
  }

  /**
   * Bug 002: SEC Rule 612 sub-penny orders on stocks >= $1.00 must be intercepted by RiskGate.
   */
  private static function testBug002_Rule612SubPennyTruncation() {
    var collar = new PriceCollarFilter(0.05)
    // 400.125 is 4001250 in fixed point (sub-penny fractional cent)
    var subPennyOrder = new Order("O-SUB", "C-SUB", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, 4001250L, 100L, "ACC1", "T1", "TAG")
    var result = collar.evaluate(subPennyOrder, null)

    assert !result.Passed : "Bug 002 Regression: Sub-penny order >= $1.00 must fail Rule 612"
  }

  /**
   * Bug 003: TWAP remaining intervals division by zero guard when all intervals completed.
   */
  private static function testBug003_TWAPZeroIntervalDivisionGuard() {
    var twap = new TWAPExecutionEngine(VenueId.NASDAQ, 0.0, 1L)
    var parent = new Order("O-TWAP", "C-TWAP", "SPY", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(500.00), 1000L, "ACC1", "T1", "TWAP")
    var prog = new ExecutionProgress(parent, 5, 500.00)

    // Complete all 5 intervals
    prog.recordSliceExecution(200L, 500.00)
    prog.recordSliceExecution(200L, 500.00)
    prog.recordSliceExecution(200L, 500.00)
    prog.recordSliceExecution(200L, 500.00)
    prog.recordSliceExecution(200L, 500.00)

    var slice = twap.computeNextSlice(parent, prog, null)
    assert slice == null : "Bug 003 Regression: computeNextSlice must safely return null when schedule completed"
  }

  /**
   * Bug 004: Self-match prevention must isolate accounts and not reject separate trading desks.
   */
  private static function testBug004_SelfMatchAccountIsolation() {
    var smp = new SelfMatchPreventionFilter(SelfMatchPreventionFilter.SMPMode.CANCEL_NEWEST)
    var restingSell = new Order("R-DESK1", "CR1", "NVDA", Side.SELL, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(120.00), 1000L, "DESK_QUANT_1", "T1", "ALGO")
    restingSell.transitionStatus(fairlead.model.OrderStatus.NEW)
    smp.registerRestingOrder(restingSell)

    // Buy from a different firm desk account must pass without wash-sale false positive
    var clientBuy = new Order("B-DESK2", "CB1", "NVDA", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(120.00), 500L, "DESK_FLOW_2", "T2", "ALGO")
    var res = smp.evaluate(clientBuy, null)

    assert res.Passed : "Bug 004 Regression: Different account desk must not trigger wash-sale block"
  }

  /**
   * Bug 005: Unallocated quantity tracking when market book depth is less than order size.
   */
  private static function testBug005_UnallocatedRemainderOnPartialVenueCapacity() {
    var router = new RegNMSProtectedQuoteRouter(null)
    // Only 600 shares available at NBBO
    var nbbo = new NBBO("AAPL", PriceLevel.fromDouble(180.00), 500L, Arrays.asList({VenueId.NASDAQ}),
                        PriceLevel.fromDouble(180.05), 600L, Arrays.asList({VenueId.NASDAQ}), System.nanoTime(), 1L)

    var books = new java.util.HashMap<VenueId, fairlead.marketdata.OrderBookLevel2>()
    var nasd = new fairlead.marketdata.OrderBookLevel2(VenueId.NASDAQ, "AAPL")
    nasd.updateLevel(Side.SELL, PriceLevel.fromDouble(180.05), 600L, 1, System.nanoTime(), 1L)
    books.put(VenueId.NASDAQ, nasd)

    // Order wants 2,000 shares
    var order = new Order("O-BIG", "C-BIG", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.05), 2000L, "ACC1", "T1", "REG_NMS")
    var plan = router.route(order, nbbo, books)

    assert plan.TotalAllocatedQuantity == 600L : "Allocated quantity must cap at 600"
    assert plan.UnallocatedQuantity == 1400L : "Bug 005 Regression: Unallocated quantity must reflect exact remaining 1400 shares"
  }
}
