package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.FillAllocation
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses java.util.Random

/**
 * Time-Weighted Average Price (TWAP) execution engine.
 * Dispatches equal-volume parent order slices across uniform temporal intervals,
 * applying randomized Gaussian size jitter to camouflage order footprint and prevent predatory front-running.
 */
class TWAPExecutionEngine implements IExecutionStrategy {
  var _preferredVenue : VenueId as PreferredVenue
  var _jitterFraction : double as JitterFraction // e.g. 0.15 for +/- 15% random variance
  var _random : Random

  construct(venue : VenueId, jitter : double, seed : long) {
    _preferredVenue = venue != null ? venue : VenueId.NASDAQ
    _jitterFraction = jitter
    _random = new Random(seed)
  }

  override property get StrategyName() : String {
    return "ALGO_TWAP"
  }

  override function computeNextSlice(parentOrder : Order, progress : ExecutionProgress, nbbo : NBBO) : FillAllocation {
    if (parentOrder == null || progress == null || progress.IsCompleted) {
      return null
    }

    var remainingIntervals = progress.TotalIntervals - progress.IntervalsCompleted
    if (remainingIntervals <= 0) {
      remainingIntervals = 1
    }

    var baseSlice = progress.RemainingQuantity / (remainingIntervals as long)
    if (baseSlice <= 0L) {
      baseSlice = progress.RemainingQuantity
    }

    // Apply random size jitter: -jitterFraction to +jitterFraction
    var jitterFactor = 1.0 + ((_random.nextDouble() * 2.0 - 1.0) * _jitterFraction)
    var jitteredSlice = java.lang.Math.round((baseSlice as double) * jitterFactor)

    // Round to nearest 100 shares round-lot when possible
    if (jitteredSlice >= 100L) {
      jitteredSlice = (jitteredSlice / 100L) * 100L
    }

    // Ensure slice stays within remaining bounds
    var sliceQty = java.lang.Math.max(10L, java.lang.Math.min(progress.RemainingQuantity, jitteredSlice))

    // Determine target execution limit price
    var targetPx = parentOrder.LimitPrice
    if (nbbo != null && nbbo.IsValid) {
      if (parentOrder.Side.IsBuy) {
        // Buy TWAP: target current ask (aggressive) or midpoint (passive)
        targetPx = java.lang.Math.min(parentOrder.LimitPrice, nbbo.BestAskPrice)
      } else {
        // Sell TWAP: target current bid (aggressive) or midpoint (passive)
        targetPx = java.lang.Math.max(parentOrder.LimitPrice, nbbo.BestBidPrice)
      }
    }

    return new FillAllocation(_preferredVenue, sliceQty, targetPx, 0.0, StrategyName, progress.IntervalsCompleted + 1, _preferredVenue.BaseLatencyMicros)
  }

  override function isScheduleComplete(progress : ExecutionProgress) : boolean {
    return progress != null && progress.IsCompleted
  }
}
