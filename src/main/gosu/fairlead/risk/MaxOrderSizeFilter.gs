package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO

/**
 * Validates that an incoming order's share quantity does not exceed institutional risk limits.
 */
class MaxOrderSizeFilter implements IRiskFilter {
  var _maxShares : long as MaxShares

  construct(maxShares : long) {
    _maxShares = maxShares
  }

  override property get FilterName() : String {
    return "MAX_ORDER_SIZE"
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) {
      return RiskCheckResult.fail(FilterName, "Order is null")
    }
    if (order.Quantity <= 0L) {
      return RiskCheckResult.fail(FilterName, "Order quantity must be strictly positive: " + order.Quantity)
    }
    if (order.Quantity > _maxShares) {
      return RiskCheckResult.fail(FilterName, "Order quantity " + order.Quantity + " exceeds maximum threshold " + _maxShares)
    }
    return RiskCheckResult.pass(FilterName)
  }
}
