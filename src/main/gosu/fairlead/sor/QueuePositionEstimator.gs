package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map
uses java.util.HashMap

/**
 * Quantitative queue position tracker and fill probability estimator.
 * Estimates FIFO queue depletion velocity, expected time-to-fill, and adverse selection
 * risk for passive resting limit orders under continuous market flow.
 */
class QueuePositionEstimator {
  static class TrackedQueueState {
    var _orderId : String as OrderId
    var _initialVolumeAhead : long as InitialVolumeAhead
    var _currentVolumeAhead : long as CurrentVolumeAhead
    var _orderSize : long as OrderSize
    var _arrivalTimestampNs : long as ArrivalTimestampNs

    construct(id : String, volumeAhead : long, size : long) {
      _orderId = id
      _initialVolumeAhead = volumeAhead
      _currentVolumeAhead = volumeAhead
      _orderSize = size
      _arrivalTimestampNs = java.lang.System.nanoTime()
    }

    public function recordTradeVolume(tradedQty : long) {
      _currentVolumeAhead = java.lang.Math.max(0L, _currentVolumeAhead - tradedQty)
    }

    public property get QueueDepletionRatio() : double {
      if (_initialVolumeAhead == 0L) return 1.0
      return 1.0 - ((_currentVolumeAhead as double) / (_initialVolumeAhead as double))
    }
  }

  var _trackedOrders : Map<String, TrackedQueueState> as TrackedOrders

  construct() {
    _trackedOrders = new HashMap<String, TrackedQueueState>()
  }

  public function registerOrder(order : Order, book : OrderBookLevel2) : TrackedQueueState {
    if (order == null || book == null) return null

    var volumeAhead = 0L
    if (order.Side.IsBuy) {
      // Find volume currently at order's limit price
      var level = book.BestBid
      if (level != null && level.Price == order.LimitPrice) {
        volumeAhead = level.TotalQuantity
      }
    } else {
      var level = book.BestAsk
      if (level != null && level.Price == order.LimitPrice) {
        volumeAhead = level.TotalQuantity
      }
    }

    var state = new TrackedQueueState(order.OrderId, volumeAhead, order.Quantity)
    _trackedOrders.put(order.OrderId, state)
    return state
  }

  public function onTradeAtLevel(orderId : String, executedQty : long) {
    var state = _trackedOrders.get(orderId)
    if (state != null) {
      state.recordTradeVolume(executedQty)
    }
  }

  /**
   * Computes probabilistic fill likelihood given current queue progress and average trade rate:
   * P(Fill) = 1.0 / (1.0 + exp( -3.0 * (progress - 0.5) ))
   */
  public function estimateFillProbability(orderId : String, tradeRateSharesPerSec : double) : double {
    var state = _trackedOrders.get(orderId)
    if (state == null) return 0.0

    if (state.CurrentVolumeAhead == 0L) {
      return 1.0 // Front of queue
    }

    var progress = state.QueueDepletionRatio
    // Logistic curve mapping queue depletion progress to fill probability
    var z = 6.0 * (progress - 0.5)
    return 1.0 / (1.0 + java.lang.Math.exp(-z))
  }

  /**
   * Estimates remaining waiting time in milliseconds given continuous trade burn rate.
   */
  public function estimateRemainingWaitMs(orderId : String, tradeRateSharesPerSec : double) : double {
    var state = _trackedOrders.get(orderId)
    if (state == null || tradeRateSharesPerSec <= 0.0) return 0.0

    var remainingShares = state.CurrentVolumeAhead as double
    return (remainingShares / tradeRateSharesPerSec) * 1000.0
  }

  public function removeOrder(orderId : String) {
    _trackedOrders.remove(orderId)
  }

  public function clear() {
    _trackedOrders.clear()
  }
}
