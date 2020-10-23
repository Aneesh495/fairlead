package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.model.Side
uses fairlead.model.FillAllocation
uses fairlead.model.FeeSchedule
uses fairlead.marketdata.OrderBookLevel2
uses fairlead.model.PriceLevel
uses java.util.Map
uses java.util.List
uses java.util.ArrayList
uses java.util.Collections
uses java.util.Comparator

/**
 * Depth of Book sweep router that slices parent aggressive orders across multiple price levels
 * and exchange venues, minimizing market impact and executing large block slices efficiently.
 */
class DepthOfBookSweepRouter implements ISmartOrderRouter {
  static class CandidateVenueLevel {
    var _venue : VenueId as Venue
    var _price : long as Price
    var _availableQty : long as AvailableQuantity
    var _effectivePrice : double as EffectivePrice

    construct(venue : VenueId, px : long, qty : long, effPx : double) {
      _venue = venue
      _price = px
      _availableQty = qty
      _effectivePrice = effPx
    }
  }

  var _feeSchedule : FeeSchedule as FeeSchedule

  construct(feeSched : FeeSchedule) {
    _feeSchedule = feeSched != null ? feeSched : new FeeSchedule()
  }

  override property get StrategyName() : String {
    return "DEPTH_OF_BOOK_SWEEP"
  }

  override function route(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var decision = new RoutingDecision(order, StrategyName, "Depth of book multi-level sweep")

    if (order == null || order.LeavesQuantity <= 0L || books == null || books.isEmpty()) {
      return decision
    }

    var isBuy = order.Side.IsBuy
    var remaining = order.LeavesQuantity
    var limitPx = order.OrderType.RequiresLimitPrice ? order.LimitPrice : (isBuy ? java.lang.Long.MAX_VALUE : 0L)

    // Aggregate candidate price levels across all participating venue books
    var candidates = new ArrayList<CandidateVenueLevel>()

    for (entry in books.entrySet()) {
      var venue = entry.getKey()
      var book = entry.getValue()
      if (book == null) continue

      var levels = isBuy ? book.getAskDepth(10) : book.getBidDepth(10)
      for (lvl in levels) {
        var price = lvl.Price
        // Verify price meets order limit constraints
        var isWithinLimit = isBuy ? (price <= limitPx) : (price >= limitPx)
        if (isWithinLimit && lvl.TotalQuantity > 0L) {
          var rawPx = (price as double) / 10000.0
          var effPx = _feeSchedule.computeEffectivePrice(order.Side, rawPx, lvl.TotalQuantity, venue, false)
          candidates.add(new CandidateVenueLevel(venue, price, lvl.TotalQuantity, effPx))
        }
      }
    }

    // Sort candidates:
    // For Buy: lowest price first, then lowest effective price (lowest fees), then lowest latency
    // For Sell: highest price first, then highest effective price, then lowest latency
    Collections.sort(candidates, new Comparator<CandidateVenueLevel>() {
      override function compare(a : CandidateVenueLevel, b : CandidateVenueLevel) : int {
        if (isBuy) {
          var pxComp = java.lang.Long.compare(a.Price, b.Price)
          if (pxComp != 0) return pxComp
          var effComp = java.lang.Double.compare(a.EffectivePrice, b.EffectivePrice)
          if (effComp != 0) return effComp
          return java.lang.Long.compare(a.Venue.BaseLatencyMicros, b.Venue.BaseLatencyMicros)
        } else {
          var pxComp = java.lang.Long.compare(b.Price, a.Price)
          if (pxComp != 0) return pxComp
          var effComp = java.lang.Double.compare(b.EffectivePrice, a.EffectivePrice)
          if (effComp != 0) return effComp
          return java.lang.Long.compare(a.Venue.BaseLatencyMicros, b.Venue.BaseLatencyMicros)
        }
      }
    })

    var priority = 1
    for (cand in candidates) {
      if (remaining <= 0L) break

      var sliceQty = java.lang.Math.min(remaining, cand.AvailableQuantity)
      if (sliceQty > 0L) {
        var fee = _feeSchedule.computeExchangeFeeOrRebate(cand.Venue, sliceQty, false)
        var alloc = new FillAllocation(cand.Venue, sliceQty, cand.Price, fee, StrategyName, priority, cand.Venue.BaseLatencyMicros)
        decision.addAllocation(alloc)
        remaining -= sliceQty
        priority++
      }
    }

    return decision
  }
}
