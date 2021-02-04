package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses fairlead.model.FillAllocation
uses fairlead.marketdata.OrderBookLevel2
uses fairlead.sor.RoutingDecision
uses java.util.Map
uses java.util.List
uses java.util.ArrayList

/**
 * Sniper Algorithmic Execution Strategy.
 * Stealth liquidity-taking engine that monitors fragmented market quotes silently.
 * Upon detecting matching or midpoint liquidity at or better than the target price,
 * fires instantaneous IOC (Immediate-Or-Cancel) sweep bursts across target venues
 * without displaying intent in public order books.
 */
class SniperStrategy implements IExecutionStrategy {
  private var _targetPriceLimit : long
  private var _minBurstSize : long
  private var _maxBurstSize : long
  private var _burstCount : int

  public construct(targetPriceLimit : long, minBurstSize : long, maxBurstSize : long) {
    _targetPriceLimit = targetPriceLimit
    _minBurstSize = minBurstSize
    _maxBurstSize = maxBurstSize
    _burstCount = 0
  }

  override public property get StrategyName() : String {
    return "SNIPER_STEALTH_SWEEP"
  }

  public property get BurstCount() : int {
    return _burstCount
  }

  override public function isScheduleComplete(progress : ExecutionProgress) : boolean {
    return progress != null && progress.IsCompleted
  }

  override public function computeNextSlice(parentOrder : Order, progress : ExecutionProgress, nbbo : NBBO) : FillAllocation {
    if (parentOrder == null || progress == null || progress.RemainingQuantity <= 0L || nbbo == null || !nbbo.IsValid) {
      return null
    }

    var isBuy = parentOrder.Side == Side.BUY
    var currentMarketPrice = isBuy ? nbbo.BestAskPrice : nbbo.BestBidPrice

    // Price trigger check: only fire if current market is favorable
    var triggerMatched = isBuy ? (currentMarketPrice <= _targetPriceLimit) : (currentMarketPrice >= _targetPriceLimit)
    if (!triggerMatched) {
      return null
    }

    var burstSize = Math.min(progress.RemainingQuantity, _maxBurstSize)
    if (burstSize < _minBurstSize && progress.RemainingQuantity >= _minBurstSize) {
      return null
    }

    _burstCount++
    var targetVenue = isBuy ? (nbbo.BestAskVenues.isEmpty() ? VenueId.NASDAQ : nbbo.BestAskVenues.get(0))
                            : (nbbo.BestBidVenues.isEmpty() ? VenueId.NASDAQ : nbbo.BestBidVenues.get(0))

    return new FillAllocation(targetVenue, burstSize, currentMarketPrice, 1, StrategyName + "_IOC")
  }

  /**
   * Sweeps multi-venue order books for resting liquidity in stealth bursts.
   */
  public function sweepVenues(order : Order, nbbo : NBBO, venueBooks : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var dec = new RoutingDecision(order, StrategyName, "Sniper stealth sweep")
    if (order == null || order.LeavesQuantity <= 0 || nbbo == null || !nbbo.IsValid) {
      return dec
    }

    var isBuy = order.Side == Side.BUY
    var currentMarketPrice = isBuy ? nbbo.BestAskPrice : nbbo.BestBidPrice

    var triggerMatched = isBuy ? (currentMarketPrice <= _targetPriceLimit) : (currentMarketPrice >= _targetPriceLimit)
    if (!triggerMatched) {
      return dec
    }

    var burstSize = Math.min(order.LeavesQuantity, _maxBurstSize)
    if (burstSize < _minBurstSize && order.LeavesQuantity >= _minBurstSize) {
      return dec
    }

    var remaining = burstSize
    var prio = 1

    for (entry in venueBooks.entrySet()) {
      if (remaining <= 0) break

      var venue = entry.Key
      var book = entry.Value
      var bookTopPrice = isBuy ? book.BestAskPrice : book.BestBidPrice
      var bookTopSize = isBuy ? book.BestAskSize : book.BestBidSize

      if (bookTopSize <= 0) continue

      var priceAcceptable = isBuy ? (bookTopPrice <= _targetPriceLimit) : (bookTopPrice >= _targetPriceLimit)
      if (priceAcceptable) {
        var slice = Math.min(remaining, bookTopSize)
        dec.addAllocation(new FillAllocation(venue, slice, bookTopPrice, prio, StrategyName + "_IOC"))
        remaining -= slice
        prio++
      }
    }

    if (dec.TotalAllocatedQuantity > 0) {
      _burstCount++
    }

    return dec
  }
}
