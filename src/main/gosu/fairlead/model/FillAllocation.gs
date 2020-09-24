package fairlead.model

/**
 * Child slice allocation plan determined by the Smart Order Router.
 * Maps target venue, planned quantity, execution limit price, and expected fee economics.
 */
class FillAllocation {
  var _venue : VenueId as Venue
  var _slicedQuantity : long as SlicedQuantity
  var _targetPrice : long as TargetPrice
  var _expectedFeeOrRebate : double as ExpectedFeeOrRebate
  var _strategyTag : String as StrategyTag
  var _routePriority : int as RoutePriority
  var _estimatedLatencyMicros : long as EstimatedLatencyMicros
  var _filledQuantity : long as FilledQuantity
  var _isCompleted : boolean as IsCompleted

  construct(venue : VenueId, qty : long, targetPx : long, expFee : double,
            tag : String, priority : int, latencyMicros : long) {
    _venue = venue
    _slicedQuantity = qty
    _targetPrice = targetPx
    _expectedFeeOrRebate = expFee
    _strategyTag = tag
    _routePriority = priority
    _estimatedLatencyMicros = latencyMicros
    _filledQuantity = 0L
    _isCompleted = false
  }

  public function recordFill(qty : long) {
    _filledQuantity += qty
    if (_filledQuantity >= _slicedQuantity) {
      _isCompleted = true
    }
  }

  public property get LeavesQuantity() : long {
    return java.lang.Math.max(0L, _slicedQuantity - _filledQuantity)
  }

  override function toString() : String {
    return "FillAllocation[" + _venue + " qty=" + _slicedQuantity + " @ " +
           (_targetPrice as double)/10000.0 + " prio=" + _routePriority + " tag=" + _strategyTag + "]"
  }
}
