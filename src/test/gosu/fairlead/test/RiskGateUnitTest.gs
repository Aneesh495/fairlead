package fairlead.test

uses fairlead.risk.RiskGate
uses fairlead.risk.MaxOrderSizeFilter
uses fairlead.risk.MaxOrderNotionalFilter
uses fairlead.risk.PriceCollarFilter
uses fairlead.risk.GrossDailyNotionalFilter
uses fairlead.risk.NetPositionFilter
uses fairlead.risk.SelfMatchPreventionFilter
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses java.util.Arrays

/**
 * Unit test suite verifying SEC Rule 15c3-5 Market Access pre-trade risk controls.
 */
class RiskGateUnitTest {
  public static function run() : boolean {
    print("  -> Running RiskGateUnitTest...")
    testMaxOrderSize()
    testMaxNotional()
    testPriceCollarAndSubPenny()
    testSelfMatchPrevention()
    return true
  }

  private static function testMaxOrderSize() {
    var filter = new MaxOrderSizeFilter(5000L)
    var good = new Order("O1", "C1", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(150.00), 2000L, "A1", "T1", "TAG")
    var bad = new Order("O2", "C2", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(150.00), 6000L, "A1", "T1", "TAG")

    assert filter.evaluate(good, null).Passed : "Good order must pass size filter"
    assert !filter.evaluate(bad, null).Passed : "Bad order must fail size filter"
  }

  private static function testMaxNotional() {
    var filter = new MaxOrderNotionalFilter(500000.0)
    var good = new Order("O1", "C1", "TSLA", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(200.00), 2000L, "A1", "T1", "TAG") // $400k
    var bad = new Order("O2", "C2", "TSLA", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(200.00), 3000L, "A1", "T1", "TAG") // $600k

    assert filter.evaluate(good, null).Passed : "Good notional must pass"
    assert !filter.evaluate(bad, null).Passed : "Bad notional must fail"
  }

  private static function testPriceCollarAndSubPenny() {
    var filter = new PriceCollarFilter(0.05) // 5% collar
    var nbbo = new NBBO("MSFT", PriceLevel.fromDouble(400.00), 1000L, Arrays.asList({VenueId.NASDAQ}),
                        PriceLevel.fromDouble(400.10), 1000L, Arrays.asList({VenueId.NASDAQ}), System.nanoTime(), 1L)

    var goodBuy = new Order("O1", "C1", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(410.00), 100L, "A1", "T1", "TAG")
    var fatFingerBuy = new Order("O2", "C2", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(450.00), 100L, "A1", "T1", "TAG")
    var subPennyBuy = new Order("O3", "C3", "MSFT", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, 4001250L, 100L, "A1", "T1", "TAG")

    assert filter.evaluate(goodBuy, nbbo).Passed : "Order within collar must pass"
    assert !filter.evaluate(fatFingerBuy, nbbo).Passed : "Fat-finger order must breach collar"
    assert !filter.evaluate(subPennyBuy, nbbo).Passed : "Sub-penny order must breach Rule 612"
  }

  private static function testSelfMatchPrevention() {
    var smp = new SelfMatchPreventionFilter(SelfMatchPreventionFilter.SMPMode.CANCEL_NEWEST)
    var restingSell = new Order("R1", "CR1", "AMZN", Side.SELL, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.00), 500L, "DESK_A", "T1", "ALGO")
    restingSell.transitionStatus(fairlead.model.OrderStatus.NEW)
    smp.registerRestingOrder(restingSell)

    var matchingBuy = new Order("B1", "CB1", "AMZN", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.00), 500L, "DESK_A", "T2", "ALGO")
    var nonMatchingBuy = new Order("B2", "CB2", "AMZN", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.00), 500L, "DESK_B", "T3", "ALGO")

    assert !smp.evaluate(matchingBuy, null).Passed : "Matching account buy must be blocked by SMP"
    assert smp.evaluate(nonMatchingBuy, null).Passed : "Non-matching account buy must pass SMP"
  }
}
