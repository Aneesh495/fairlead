package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.model.Side
uses fairlead.model.FillAllocation
uses fairlead.model.FeeSchedule
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map
uses java.util.List
uses java.util.ArrayList
uses java.util.Collections
uses java.util.Comparator

/**
 * Cost-aware and rebate-optimizing Smart Order Router.
 * Computes all-in net execution prices across maker-taker exchanges, inverted taker-maker
 * venues (e.g., EDGA), and zero-fee dark pools to maximize net realized trading PnL.
 */
class CostAwareRouter implements ISmartOrderRouter {
  static class CostRankedVenue {
    var _venue : VenueId as Venue
    var _price : long as Price
    var _availableQty : long as AvailableQuantity
    var _netEffectivePrice : double as NetEffectivePrice
    var _expectedFeeOrRebate : double as ExpectedFeeOrRebate

    construct(v : VenueId, px : long, qty : long, effPx : double, fee : double) {
      _venue = v
      _price = px
      _availableQty = qty
      _netEffectivePrice = effPx
      _expectedFeeOrRebate = fee
    }
  }

  var _feeSchedule : FeeSchedule as FeeSchedule

  construct(feeSched : FeeSchedule) {
    _feeSchedule = feeSched != null ? feeSched : new FeeSchedule()
  }

  override property get StrategyName() : String {
    return "COST_AWARE_OPTIMIZER"
  }

  override function route(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var decision = new RoutingDecision(order, StrategyName, "All-in cost and rebate optimization sweep")

    if (order == null || order.LeavesQuantity <= 0L || books == null || books.isEmpty()) {
      return decision
    }

    var isBuy = order.Side.IsBuy
    var remaining = order.LeavesQuantity
    var limitPx = order.OrderType.RequiresLimitPrice ? order.LimitPrice : (isBuy ? java.lang.Long.MAX_VALUE : 0L)

    var rankedList = new ArrayList<CostRankedVenue>()

    for (entry in books.entrySet()) {
      var venue = entry.getKey()
      var book = entry.getValue()
      if (book == null) continue

      var bestLevel = isBuy ? book.BestAsk : book.BestBid
      if (bestLevel == null || bestLevel.TotalQuantity <= 0L) continue

      var px = bestLevel.Price
      var isWithinLimit = isBuy ? (px <= limitPx) : (px >= limitPx)
      if (isWithinLimit) {
        var rawPx = (px as double) / 10000.0
        var effPx = _feeSchedule.computeEffectivePrice(order.Side, rawPx, bestLevel.TotalQuantity, venue, false)
        var fee = _feeSchedule.computeExchangeFeeOrRebate(venue, bestLevel.TotalQuantity, false)
        rankedList.add(new CostRankedVenue(venue, px, bestLevel.TotalQuantity, effPx, fee))
      }
    }

    // Sort by net effective execution price:
    // Buy: lowest net effective price first (cheapest after fees/rebates)
    // Sell: highest net effective price first (most proceeds after fees/rebates)
    Collections.sort(rankedList, new Comparator<CostRankedVenue>() {
      override function compare(a : CostRankedVenue, b : CostRankedVenue) : int {
        if (isBuy) {
          var effComp = java.lang.Double.compare(a.NetEffectivePrice, b.NetEffectivePrice)
          if (effComp != 0) return effComp
          return java.lang.Long.compare(a.Venue.BaseLatencyMicros, b.Venue.BaseLatencyMicros)
        } else {
          var effComp = java.lang.Double.compare(b.NetEffectivePrice, a.NetEffectivePrice)
          if (effComp != 0) return effComp
          return java.lang.Long.compare(a.Venue.BaseLatencyMicros, b.Venue.BaseLatencyMicros)
        }
      }
    })

    var priority = 1
    for (v in rankedList) {
      if (remaining <= 0L) break

      var sliceQty = java.lang.Math.min(remaining, v.AvailableQuantity)
      if (sliceQty > 0L) {
        var fee = _feeSchedule.computeExchangeFeeOrRebate(v.Venue, sliceQty, false)
        var alloc = new FillAllocation(v.Venue, sliceQty, v.Price, fee, StrategyName, priority, v.Venue.BaseLatencyMicros)
        decision.addAllocation(alloc)
        remaining -= sliceQty
        priority++
      }
    }

    return decision
  }
}
