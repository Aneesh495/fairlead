package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO

/**
 * Validates that the gross notional dollar value of an order does not exceed mandate limits.
 */
class MaxOrderNotionalFilter implements IRiskFilter {
  var _maxNotionalDollars : double as MaxNotionalDollars

  construct(maxNotional : double) {
    _maxNotionalDollars = maxNotional
  }

  override property get FilterName() : String {
    return "MAX_ORDER_NOTIONAL"
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) {
      return RiskCheckResult.fail(FilterName, "Order is null")
    }

    var notional = order.TotalNotionalValue
    // If market order where limit price is zero, evaluate against NBBO reference price
    if (notional == 0.0 && nbbo != null) {
      var refPx = order.Side.IsBuy ? ((nbbo.BestAskPrice as double) / 10000.0) : ((nbbo.BestBidPrice as double) / 10000.0)
      notional = refPx * (order.Quantity as double)
    }

    if (notional > _maxNotionalDollars) {
      return RiskCheckResult.fail(FilterName, "Order notional $" + java.lang.String.format("%.2f", new Object[]{notional}) +
                                              " exceeds maximum threshold $" + java.lang.String.format("%.2f", new Object[]{_maxNotionalDollars}))
    }

    return RiskCheckResult.pass(FilterName)
  }
}
