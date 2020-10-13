package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses java.util.Map
uses java.util.HashMap

/**
 * Net inventory position filter preventing over-accumulation of directional long or short
 * equity inventory beyond authorized portfolio risk parameters.
 */
class NetPositionFilter implements IRiskFilter {
  var _maxNetShares : long as MaxNetShares
  var _positionMap : Map<String, Long> as PositionMap // Key: Account:Symbol -> Net Shares

  construct(maxNetShares : long) {
    _maxNetShares = maxNetShares
    _positionMap = new HashMap<String, Long>()
  }

  override property get FilterName() : String {
    return "NET_POSITION_LIMIT"
  }

  private function makeKey(account : String, symbol : String) : String {
    return (account != null ? account : "DEFAULT") + ":" + symbol
  }

  public function getCurrentNetShares(account : String, symbol : String) : long {
    var key = makeKey(account, symbol)
    var pos = _positionMap.get(key)
    return pos != null ? pos : 0L
  }

  public function recordFill(account : String, symbol : String, side : Side, filledQty : long) {
    var key = makeKey(account, symbol)
    var current = getCurrentNetShares(account, symbol)
    var delta = side.sign() * filledQty
    _positionMap.put(key, current + delta)
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) return RiskCheckResult.fail(FilterName, "Order is null")

    var current = getCurrentNetShares(order.Account, order.Symbol)
    var proposed = current + (order.Side.sign() * order.Quantity)

    if (java.lang.Math.abs(proposed) > _maxNetShares) {
      return RiskCheckResult.fail(FilterName, "Projected net position " + proposed + " shares for " + order.Symbol +
                                              " breaches maximum threshold " + _maxNetShares)
    }

    return RiskCheckResult.pass(FilterName)
  }

  public function reset() {
    _positionMap.clear()
  }
}
