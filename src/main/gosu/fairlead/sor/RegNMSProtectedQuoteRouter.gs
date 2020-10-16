package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.model.Side
uses fairlead.model.FillAllocation
uses fairlead.model.FeeSchedule
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map

/**
 * Reg NMS Rule 611 Order Protection Rule router.
 * Prevents trade-throughs by routing child orders exclusively to automated trading centers
 * currently displaying the National Best Bid or Offer before accessing inferior price levels.
 */
class RegNMSProtectedQuoteRouter implements ISmartOrderRouter {
  var _feeSchedule : FeeSchedule as FeeSchedule

  construct(feeSched : FeeSchedule) {
    _feeSchedule = feeSched != null ? feeSched : new FeeSchedule()
  }

  override property get StrategyName() : String {
    return "REG_NMS_RULE_611"
  }

  override function route(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var decision = new RoutingDecision(order, StrategyName, "Reg NMS Rule 611 protected quote sweep")

    if (order == null || order.LeavesQuantity <= 0L) {
      return decision
    }

    if (nbbo == null || !nbbo.IsValid) {
      decision.Reason = "NBBO invalid or unavailable; routing paused to avoid trade-through"
      return decision
    }

    var remaining = order.LeavesQuantity
    var isBuy = order.Side.IsBuy
    var targetPx = isBuy ? nbbo.BestAskPrice : nbbo.BestBidPrice
    var targetVenues = isBuy ? nbbo.BestAskVenues : nbbo.BestBidVenues

    // Limit price boundary check
    if (order.OrderType.RequiresLimitPrice) {
      if (isBuy && order.LimitPrice < targetPx) {
        decision.Reason = "Order limit price $" + ((order.LimitPrice as double)/10000.0) +
                          " is lower than protected NBBO ask $" + ((targetPx as double)/10000.0)
        return decision
      }
      if (!isBuy && order.LimitPrice > targetPx) {
        decision.Reason = "Order limit price $" + ((order.LimitPrice as double)/10000.0) +
                          " is higher than protected NBBO bid $" + ((targetPx as double)/10000.0)
        return decision
      }
    }

    // Allocate across all venues currently displaying the protected best price
    var priority = 1
    for (v in targetVenues) {
      if (remaining <= 0L) break

      var book = books != null ? books.get(v) : null
      var availableOnVenue = 0L

      if (book != null) {
        availableOnVenue = isBuy ? book.BestAskSize : book.BestBidSize
      } else {
        // Default allocation if book not locally cached
        availableOnVenue = remaining
      }

      if (availableOnVenue > 0L) {
        var sliceQty = java.lang.Math.min(remaining, availableOnVenue)
        var fee = _feeSchedule.computeExchangeFeeOrRebate(v, sliceQty, false)
        var alloc = new FillAllocation(v, sliceQty, targetPx, fee, StrategyName, priority, v.BaseLatencyMicros)
        decision.addAllocation(alloc)
        remaining -= sliceQty
        priority++
      }
    }

    return decision
  }
}
