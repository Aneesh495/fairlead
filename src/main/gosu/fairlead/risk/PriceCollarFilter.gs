package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses fairlead.model.PriceLevel

/**
 * Price collar filter preventing fat-finger execution errors and runaway algorithms.
 * Rejects aggressive buy orders priced excessively above the NBBO ask, aggressive sell
 * orders priced excessively below the NBBO bid, and invalid sub-penny increments (Rule 612).
 */
class PriceCollarFilter implements IRiskFilter {
  var _maxDeviationPct : double as MaxDeviationPct // e.g., 0.05 for 5% collar

  construct(maxDeviationPct : double) {
    _maxDeviationPct = maxDeviationPct
  }

  override property get FilterName() : String {
    return "PRICE_COLLAR"
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) {
      return RiskCheckResult.fail(FilterName, "Order is null")
    }

    // Only limit orders with positive prices require collar validation
    if (!order.OrderType.RequiresLimitPrice || order.LimitPrice <= 0L) {
      return RiskCheckResult.pass(FilterName)
    }

    // SEC Rule 612 sub-penny restriction check:
    // For stocks >= $1.00 (10000 fixed point), quotation increment must be >= $0.01 (100 units)
    if (order.LimitPrice >= PriceLevel.PRICE_SCALE) {
      if (order.LimitPrice % 100L != 0L) {
        return RiskCheckResult.fail(FilterName, "Rule 612 sub-penny violation: price " +
                                                order.LimitPrice + " is not an even cent increment")
      }
    }

    if (nbbo == null || !nbbo.IsValid) {
      // In the absence of an active NBBO, cannot evaluate collar deviation safely
      return RiskCheckResult.pass(FilterName)
    }

    var orderPx = (order.LimitPrice as double) / 10000.0

    if (order.Side.IsBuy) {
      var bestAsk = (nbbo.BestAskPrice as double) / 10000.0
      var upperCollar = bestAsk * (1.0 + _maxDeviationPct)
      if (orderPx > upperCollar) {
        return RiskCheckResult.fail(FilterName, "Buy limit $" + orderPx + " breaches upper collar bound $" +
                                                java.lang.String.format("%.2f", new Object[]{upperCollar}) +
                                                " (NBBO Ask $" + bestAsk + " + " + (_maxDeviationPct * 100.0) + "%)")
      }
    } else {
      var bestBid = (nbbo.BestBidPrice as double) / 10000.0
      var lowerCollar = bestBid * (1.0 - _maxDeviationPct)
      if (orderPx < lowerCollar) {
        return RiskCheckResult.fail(FilterName, "Sell limit $" + orderPx + " breaches lower collar bound $" +
                                                java.lang.String.format("%.2f", new Object[]{lowerCollar}) +
                                                " (NBBO Bid $" + bestBid + " - " + (_maxDeviationPct * 100.0) + "%)")
      }
    }

    return RiskCheckResult.pass(FilterName)
  }
}
