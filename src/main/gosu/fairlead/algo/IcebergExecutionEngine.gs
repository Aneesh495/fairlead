package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.FillAllocation
uses fairlead.model.VenueId
uses java.util.Random

/**
 * Synthetic and native Iceberg order slicing engine.
 * Dispatches small randomized visible peaks to the limit order book, holding the majority
 * volume in hidden reserve and automatically replenishing upon fill confirmation.
 */
class IcebergExecutionEngine {
  var _preferredVenue : VenueId as PreferredVenue
  var _displayPeakSize : long as DisplayPeakSize
  var _varianceFraction : double as VarianceFraction // e.g. 0.20 for +/- 20% randomized replenishment peak
  var _random : Random

  construct(venue : VenueId, peakSize : long, variance : double, seed : long) {
    _preferredVenue = venue != null ? venue : VenueId.NASDAQ
    _displayPeakSize = peakSize > 0L ? peakSize : 500L
    _varianceFraction = variance >= 0.0 ? variance : 0.15
    _random = new Random(seed)
  }

  public property get StrategyName() : String {
    return "ALGO_ICEBERG"
  }

  /**
   * Generates the next visible peak slice from the remaining parent order reserve.
   */
  public function computeNextPeak(parentOrder : Order, remainingReserve : long, nbbo : NBBO) : FillAllocation {
    if (parentOrder == null || remainingReserve <= 0L) {
      return null
    }

    // Apply randomized variance to the peak display quantity
    var varianceMultiplier = 1.0 + ((_random.nextDouble() * 2.0 - 1.0) * _varianceFraction)
    var targetPeak = java.lang.Math.round((_displayPeakSize as double) * varianceMultiplier)

    // Round to round-lot 100 shares if possible
    if (targetPeak >= 100L) {
      targetPeak = (targetPeak / 100L) * 100L
    }

    var sliceQty = java.lang.Math.max(10L, java.lang.Math.min(remainingReserve, targetPeak))

    var targetPx = parentOrder.LimitPrice
    if (nbbo != null && nbbo.IsValid) {
      if (parentOrder.Side.IsBuy) {
        // Buy iceberg rests at current best bid (passive) or limit price
        targetPx = java.lang.Math.min(parentOrder.LimitPrice, nbbo.BestBidPrice)
      } else {
        // Sell iceberg rests at current best ask (passive) or limit price
        targetPx = java.lang.Math.max(parentOrder.LimitPrice, nbbo.BestAskPrice)
      }
    }

    return new FillAllocation(_preferredVenue, sliceQty, targetPx, 0.0, StrategyName, 1, _preferredVenue.BaseLatencyMicros)
  }
}
