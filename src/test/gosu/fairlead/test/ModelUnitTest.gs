package fairlead.test

uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.OrderStatus
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses fairlead.model.Order
uses fairlead.model.ExecutionReport
uses fairlead.model.FeeSchedule

/**
 * Unit test suite verifying core trading primitives, state transitions, and fixed-point math.
 */
class ModelUnitTest {
  public static function run() : boolean {
    print("  -> Running ModelUnitTest...")
    testSide()
    testOrderStatusTransitions()
    testPriceLevelFixedPoint()
    testOrderParentChildHierarchy()
    testExecutionReport()
    testFeeScheduleEconomics()
    return true
  }

  private static function testSide() {
    assert Side.BUY.IsBuy : "Side.BUY must be buy"
    assert !Side.BUY.IsSell : "Side.BUY must not be sell"
    assert Side.BUY.opposite() == Side.SELL : "Opposite of BUY must be SELL"
    assert Side.BUY.sign() == 1 : "BUY sign must be +1"
    assert Side.SELL.sign() == -1 : "SELL sign must be -1"
    assert Side.fromFixString("1") == Side.BUY : "FIX '1' must parse to BUY"
    assert Side.fromFixString("2") == Side.SELL : "FIX '2' must parse to SELL"
  }

  private static function testOrderStatusTransitions() {
    assert OrderStatus.PENDING_NEW.canTransitionTo(OrderStatus.NEW) : "PENDING_NEW -> NEW legal"
    assert OrderStatus.NEW.canTransitionTo(OrderStatus.PARTIALLY_FILLED) : "NEW -> PARTIAL legal"
    assert OrderStatus.PARTIALLY_FILLED.canTransitionTo(OrderStatus.FILLED) : "PARTIAL -> FILLED legal"
    assert !OrderStatus.FILLED.canTransitionTo(OrderStatus.NEW) : "FILLED cannot transition to NEW"
    assert OrderStatus.FILLED.IsTerminal : "FILLED is terminal"
    assert OrderStatus.CANCELED.IsTerminal : "CANCELED is terminal"
  }

  private static function testPriceLevelFixedPoint() {
    var rawPx = 142.50
    var fixedPx = PriceLevel.fromDouble(rawPx)
    assert fixedPx == 1425000L : "Price 142.50 must convert to 1425000 fixed point"

    var pl = new PriceLevel(fixedPx)
    pl.addOrder("ORD-1", 500L)
    pl.addOrder("ORD-2", 300L)
    assert pl.TotalQuantity == 800L : "Total quantity must be 800"
    assert pl.OrderCount == 2 : "Order count must be 2"

    pl.removeOrder("ORD-1", 500L)
    assert pl.TotalQuantity == 300L : "Remaining quantity must be 300"
    assert pl.OrderCount == 1 : "Remaining order count must be 1"
  }

  private static function testOrderParentChildHierarchy() {
    var parent = new Order("P1", "CL-P1", "NVDA", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(120.00), 2000L, "ACC1", "TR1", "ALGO")
    assert parent.IsParent : "Must be parent"
    assert !parent.IsChild : "Must not be child"

    var child = parent.createChildSlice("C1", "CL-C1", VenueId.NASDAQ, 800L, PriceLevel.fromDouble(120.00))
    assert child.IsChild : "Child must report IsChild"
    assert child.ParentOrderId == "P1" : "Child parent ID must match P1"
    assert parent.ChildOrders.size() == 1 : "Parent must register 1 child"

    parent.recordFill(800L, 119.98)
    assert parent.LeavesQuantity == 1200L : "Leaves must be 1200"
    assert parent.CumQuantity == 800L : "Cum must be 800"
    assert parent.Status == OrderStatus.PARTIALLY_FILLED : "Status must be PARTIALLY_FILLED"
  }

  private static function testExecutionReport() {
    var r = new ExecutionReport("EX1", "O1", "C1", "AAPL", Side.BUY, 400L, 150.00, 400L, 600L, 150.00, OrderStatus.PARTIALLY_FILLED, VenueId.NASDAQ, "ADDED", -0.80, "Maker fill")
    assert r.IsFill : "Must report is fill"
    assert r.IsMaker : "Must be maker"
    assert !r.IsTaker : "Must not be taker"
    assert r.PrincipalTraded == 60000.0 : "Principal must be 60,000"
    assert r.NetMoney == 59999.20 : "Net money must reflect rebate credit"
  }

  private static function testFeeScheduleEconomics() {
    var sched = new FeeSchedule()
    var nasdTakeFee = sched.computeExchangeFeeOrRebate(VenueId.NASDAQ, 1000L, false)
    assert nasdTakeFee == 3.0 : "Nasdaq take fee for 1000 shares must be $3.00"

    var edgaTakeRebate = sched.computeExchangeFeeOrRebate(VenueId.EDGA, 1000L, false)
    assert edgaTakeRebate == -1.80 : "EDGA take rebate for 1000 shares must be -$1.80"

    var batsMakeRebate = sched.computeExchangeFeeOrRebate(VenueId.BATS, 1000L, true)
    assert batsMakeRebate == -2.20 : "BATS maker rebate for 1000 shares must be -$2.20"
  }
}
