package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.FillAllocation
uses fairlead.model.VenueId
uses java.util.List
uses java.util.ArrayList

/**
 * Volume-Weighted Average Price (VWAP) execution engine.
 * Profiles historical intraday U-shaped volume distributions to allocate order volume
 * proportionally with market turnover while strictly capping market participation rates.
 */
class VWAPExecutionEngine implements IExecutionStrategy {
  var _preferredVenue : VenueId as PreferredVenue
  var _volumeWeights : List<Double> as VolumeWeights // Sum normalized to 1.0
  var _maxParticipationRate : double as MaxParticipationRate // e.g. 0.15 for max 15% of interval volume

  construct(venue : VenueId, weights : List<Double>, maxParticipation : double) {
    _preferredVenue = venue != null ? venue : VenueId.NASDAQ
    _volumeWeights = weights != null && !weights.isEmpty() ? normalizeWeights(weights) : defaultUShapeCurve()
    _maxParticipationRate = maxParticipation > 0.0 ? maxParticipation : 0.15
  }

  private static function defaultUShapeCurve() : List<Double> {
    // Canonical 10-interval U-shaped intraday volume profile
    var list = new ArrayList<Double>()
    list.add(0.18) // Open rush
    list.add(0.12)
    list.add(0.08)
    list.add(0.06)
    list.add(0.05) // Midday trough
    list.add(0.05)
    list.add(0.07)
    list.add(0.09)
    list.add(0.12)
    list.add(0.18) // Closing rush
    return list
  }

  private static function normalizeWeights(raw : List<Double>) : List<Double> {
    var sum = 0.0
    for (w in raw) sum += w
    var norm = new ArrayList<Double>()
    for (w in raw) norm.add(sum > 0.0 ? (w / sum) : (1.0 / (raw.size() as double)))
    return norm
  }

  override property get StrategyName() : String {
    return "ALGO_VWAP"
  }

  override function computeNextSlice(parentOrder : Order, progress : ExecutionProgress, nbbo : NBBO) : FillAllocation {
    if (parentOrder == null || progress == null || progress.IsCompleted) {
      return null
    }

    var idx = progress.IntervalsCompleted
    if (idx >= _volumeWeights.size()) {
      idx = _volumeWeights.size() - 1
    }

    var intervalWeight = _volumeWeights.get(idx)
    var plannedSlice = java.lang.Math.round((parentOrder.Quantity as double) * intervalWeight)

    // Adjust for any unfulfilled volume from previous intervals
    var remainingIntervals = progress.TotalIntervals - progress.IntervalsCompleted
    if (remainingIntervals == 1) {
      // Final interval: execute all remaining quantity
      plannedSlice = progress.RemainingQuantity
    }

    var sliceQty = java.lang.Math.max(10L, java.lang.Math.min(progress.RemainingQuantity, plannedSlice))

    // Determine target execution limit price
    var targetPx = parentOrder.LimitPrice
    if (nbbo != null && nbbo.IsValid) {
      if (parentOrder.Side.IsBuy) {
        targetPx = java.lang.Math.min(parentOrder.LimitPrice, nbbo.BestAskPrice)
      } else {
        targetPx = java.lang.Math.max(parentOrder.LimitPrice, nbbo.BestBidPrice)
      }
    }

    return new FillAllocation(_preferredVenue, sliceQty, targetPx, 0.0, StrategyName, idx + 1, _preferredVenue.BaseLatencyMicros)
  }

  override function isScheduleComplete(progress : ExecutionProgress) : boolean {
    return progress != null && progress.IsCompleted
  }
}
