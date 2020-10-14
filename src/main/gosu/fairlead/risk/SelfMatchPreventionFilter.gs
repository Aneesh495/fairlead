package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses java.util.Map
uses java.util.HashMap
uses java.util.List
uses java.util.ArrayList

/**
 * Self-Match Prevention (SMP) filter eliminating pre-arranged wash trading
 * and accidental internal execution matching across internal accounts and algorithms.
 */
class SelfMatchPreventionFilter implements IRiskFilter {
  public enum SMPMode {
    CANCEL_NEWEST,
    CANCEL_OLDEST,
    DECREMENT_BOTH
  }

  var _mode : SMPMode as Mode
  // Key: Symbol:Account -> List of active resting orders
  var _activeRestingOrders : Map<String, List<Order>> as RestingOrders

  construct(mode : SMPMode) {
    _mode = mode
    _activeRestingOrders = new HashMap<String, List<Order>>()
  }

  override property get FilterName() : String {
    return "SELF_MATCH_PREVENTION"
  }

  private function makeKey(symbol : String, account : String) : String {
    return symbol + ":" + (account != null ? account : "DEFAULT")
  }

  public function registerRestingOrder(order : Order) {
    if (order == null || !order.Status.IsActive) return
    var key = makeKey(order.Symbol, order.Account)
    var list = _activeRestingOrders.get(key)
    if (list == null) {
      list = new ArrayList<Order>()
      _activeRestingOrders.put(key, list)
    }
    list.add(order)
  }

  public function removeRestingOrder(order : Order) {
    if (order == null) return
    var key = makeKey(order.Symbol, order.Account)
    var list = _activeRestingOrders.get(key)
    if (list != null) {
      list.remove(order)
    }
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) return RiskCheckResult.fail(FilterName, "Order is null")

    var key = makeKey(order.Symbol, order.Account)
    var restingList = _activeRestingOrders.get(key)
    if (restingList == null || restingList.isEmpty()) {
      return RiskCheckResult.pass(FilterName)
    }

    var oppSide = order.Side.opposite()

    for (resting in restingList) {
      if (resting.Side == oppSide && resting.Status.IsActive) {
        // Check price collision
        var wouldCross = false
        if (order.Side.IsBuy) {
          // Incoming buy crosses if buy price >= resting sell price
          wouldCross = order.LimitPrice >= resting.LimitPrice
        } else {
          // Incoming sell crosses if sell price <= resting buy price
          wouldCross = order.LimitPrice <= resting.LimitPrice
        }

        if (wouldCross) {
          return RiskCheckResult.fail(FilterName, "Self-match detected in " + order.Symbol +
                                                  " against resting order " + resting.OrderId +
                                                  " (Account: " + order.Account + ") at price " +
                                                  resting.LimitPrice)
        }
      }
    }

    return RiskCheckResult.pass(FilterName)
  }

  public function clear() {
    _activeRestingOrders.clear()
  }
}
