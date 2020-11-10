package fairlead.algo

uses fairlead.model.Order

/**
 * State tracking vehicle for algorithmic execution strategies (TWAP, VWAP, Almgren-Chriss).
 * Measures schedule progress, interval completions, execution slippage, and cumulative volume.
 */
class ExecutionProgress {
  var _parentOrderId : String as ParentOrderId
  var _totalQuantity : long as TotalQuantity
  var _executedQuantity : long as ExecutedQuantity
  var _vwap : double as VolumeWeightedAveragePrice
  var _intervalsCompleted : int as IntervalsCompleted
  var _totalIntervals : int as TotalIntervals
  var _startTimeNs : long as StartTimeNs
  var _lastSliceTimeNs : long as LastSliceTimeNs
  var _arrivalPrice : double as ArrivalPrice

  construct(parent : Order, totalIntervals : int, arrivalPx : double) {
    _parentOrderId = parent != null ? parent.OrderId : "UNKNOWN"
    _totalQuantity = parent != null ? parent.Quantity : 0L
    _executedQuantity = 0L
    _vwap = 0.0
    _intervalsCompleted = 0
    _totalIntervals = totalIntervals
    _startTimeNs = java.lang.System.nanoTime()
    _lastSliceTimeNs = _startTimeNs
    _arrivalPrice = arrivalPx
  }

  public function recordSliceExecution(sliceQty : long, fillPx : double) {
    if (sliceQty <= 0L) return
    var oldQty = _executedQuantity
    var newQty = oldQty + sliceQty
    _executedQuantity = newQty
    _vwap = ((_vwap * (oldQty as double)) + (fillPx * (sliceQty as double))) / (newQty as double)
    _intervalsCompleted++
    _lastSliceTimeNs = java.lang.System.nanoTime()
  }

  public property get RemainingQuantity() : long {
    return java.lang.Math.max(0L, _totalQuantity - _executedQuantity)
  }

  public property get IsCompleted() : boolean {
    return RemainingQuantity == 0L || _intervalsCompleted >= _totalIntervals
  }

  public property get CompletionPercentage() : double {
    return _totalQuantity > 0L ? (((_executedQuantity as double) / (_totalQuantity as double)) * 100.0) : 100.0
  }

  /**
   * Computes implementation shortfall slippage in basis points relative to arrival price.
   */
  public function computeSlippageBps(isBuy : boolean) : double {
    if (_arrivalPrice <= 0.0 || _vwap <= 0.0) return 0.0
    var diff = isBuy ? (_vwap - _arrivalPrice) : (_arrivalPrice - _vwap)
    return (diff / _arrivalPrice) * 10000.0
  }

  override function toString() : String {
    return "ExecProgress[" + _parentOrderId + " " + _executedQuantity + "/" + _totalQuantity +
           " (" + java.lang.String.format("%.1f", new Object[]{CompletionPercentage}) + "%) " +
           "vwap=$" + java.lang.String.format("%.4f", new Object[]{_vwap}) +
           " intervals=" + _intervalsCompleted + "/" + _totalIntervals + "]"
  }
}
