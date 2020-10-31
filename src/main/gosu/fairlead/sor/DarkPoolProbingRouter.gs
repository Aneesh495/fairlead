package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.model.FillAllocation
uses fairlead.model.FeeSchedule
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map
uses java.util.List
uses java.util.ArrayList

/**
 * Dark pool probing router routing non-displayed conditional and midpoint orders to alternative
 * trading systems (ATS) with minimum fill size (MAQ) constraints to minimize information leakage.
 */
class DarkPoolProbingRouter implements ISmartOrderRouter {
  var _feeSchedule : FeeSchedule as FeeSchedule
  var _minimumFillSize : long as MinimumFillSize
  var _probeVenues : List<VenueId> as ProbeVenues

  construct(feeSched : FeeSchedule, minFillSize : long) {
    _feeSchedule = feeSched != null ? feeSched : new FeeSchedule()
    _minimumFillSize = minFillSize
    _probeVenues = new ArrayList<VenueId>()
    _probeVenues.add(VenueId.DARK_POOL_A)
    _probeVenues.add(VenueId.DARK_POOL_B)
  }

  override property get StrategyName() : String {
    return "DARK_POOL_PROBE"
  }

  override function route(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var decision = new RoutingDecision(order, StrategyName, "Midpoint non-displayed dark pool probing")

    if (order == null || order.LeavesQuantity <= 0L) {
      return decision
    }

    if (nbbo == null || !nbbo.IsValid) {
      decision.Reason = "NBBO invalid; cannot price midpoint dark probe"
      return decision
    }

    // Check if remaining quantity satisfies minimum fill size constraint
    if (order.LeavesQuantity < _minimumFillSize) {
      decision.Reason = "Order leaves " + order.LeavesQuantity + " is below minimum dark probe threshold " + _minimumFillSize
      return decision
    }

    var midpoint = nbbo.Midpoint
    var isBuy = order.Side.IsBuy

    // Verify limit price covers midpoint
    if (order.OrderType.RequiresLimitPrice) {
      if (isBuy && order.LimitPrice < midpoint) {
        decision.Reason = "Buy limit $" + ((order.LimitPrice as double)/10000.0) +
                          " is below NBBO midpoint $" + ((midpoint as double)/10000.0)
        return decision
      }
      if (!isBuy && order.LimitPrice > midpoint) {
        decision.Reason = "Sell limit $" + ((order.LimitPrice as double)/10000.0) +
                          " is above NBBO midpoint $" + ((midpoint as double)/10000.0)
        return decision
      }
    }

    // Probe dark venues in sequence of lowest latency and lowest take fee
    var remaining = order.LeavesQuantity
    var priority = 1

    for (darkVenue in _probeVenues) {
      if (remaining <= 0L) break

      var probeQty = remaining
      var fee = _feeSchedule.computeExchangeFeeOrRebate(darkVenue, probeQty, false)
      var alloc = new FillAllocation(darkVenue, probeQty, midpoint, fee, StrategyName, priority, darkVenue.BaseLatencyMicros)
      decision.addAllocation(alloc)
      remaining -= probeQty
      priority++
    }

    return decision
  }
}
