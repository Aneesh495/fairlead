package fairlead.analytics

uses fairlead.model.Order
uses fairlead.model.ExecutionReport
uses fairlead.model.Side
uses java.util.Map
uses java.util.HashMap

/**
 * Transaction Cost Analysis (TCA) engine measuring execution efficiency against
 * arrival price, interval VWAP, and Perold (1988) Implementation Shortfall benchmarks.
 */
class TransactionCostAnalyzer {
  static class OrderTCAResult {
    var _orderId : String as OrderId
    var _symbol : String as Symbol
    var _side : Side as Side
    var _sharesExecuted : long as SharesExecuted
    var _unfilledShares : long as UnfilledShares
    var _arrivalPrice : double as ArrivalPrice
    var _averageExecutedPrice : double as AverageExecutedPrice
    var _marketVWAP : double as MarketVWAP
    var _arrivalSlippageBps : double as ArrivalSlippageBps
    var _vwapSlippageBps : double as VWAPSlippageBps
    var _implementationShortfallDollars : double as ImplementationShortfallDollars
    var _totalFeesPaid : double as TotalFeesPaid

    construct(id : String, sym : String, side : Side, executed : long, unfilled : long,
              arrival : double, execPx : double, vwap : double, fees : double) {
      _orderId = id
      _symbol = sym
      _side = side
      _sharesExecuted = executed
      _unfilledShares = unfilled
      _arrivalPrice = arrival
      _averageExecutedPrice = execPx
      _marketVWAP = vwap
      _totalFeesPaid = fees

      computeMetrics()
    }

    private function computeMetrics() {
      if (_arrivalPrice > 0.0 && _averageExecutedPrice > 0.0) {
        var diffArrival = _side.IsBuy ? (_averageExecutedPrice - _arrivalPrice) : (_arrivalPrice - _averageExecutedPrice)
        _arrivalSlippageBps = (diffArrival / _arrivalPrice) * 10000.0
        var executedShortfall = diffArrival * (_sharesExecuted as double)
        _implementationShortfallDollars = executedShortfall + _totalFeesPaid
      } else {
        _arrivalSlippageBps = 0.0
        _implementationShortfallDollars = _totalFeesPaid
      }

      if (_marketVWAP > 0.0 && _averageExecutedPrice > 0.0) {
        var diffVwap = _side.IsBuy ? (_averageExecutedPrice - _marketVWAP) : (_marketVWAP - _averageExecutedPrice)
        _vwapSlippageBps = (diffVwap / _marketVWAP) * 10000.0
      } else {
        _vwapSlippageBps = 0.0
      }
    }
  }

  var _results : Map<String, OrderTCAResult> as Results
  var _totalAnalyzedOrders : long as TotalAnalyzedOrders
  var _totalExecutedShares : long as TotalExecutedShares
  var _totalShortfallDollars : double as TotalShortfallDollars

  construct() {
    _results = new HashMap<String, OrderTCAResult>()
    _totalAnalyzedOrders = 0L
    _totalExecutedShares = 0L
    _totalShortfallDollars = 0.0
  }

  public function analyzeOrder(parent : Order, arrivalPx : double, marketVwap : double, totalFees : double) : OrderTCAResult {
    if (parent == null) return null

    var result = new OrderTCAResult(
      parent.OrderId,
      parent.Symbol,
      parent.Side,
      parent.CumQuantity,
      parent.LeavesQuantity,
      arrivalPx,
      parent.AvgPrice,
      marketVwap,
      totalFees
    )

    _results.put(parent.OrderId, result)
    _totalAnalyzedOrders++
    _totalExecutedShares += parent.CumQuantity
    _totalShortfallDollars += result.ImplementationShortfallDollars

    return result
  }

  public function getAverageArrivalSlippageBps() : double {
    if (_results.isEmpty()) return 0.0
    var sumBps = 0.0
    for (r in _results.values()) {
      sumBps += r.ArrivalSlippageBps
    }
    return sumBps / (_results.size() as double)
  }

  public function clear() {
    _results.clear()
    _totalAnalyzedOrders = 0L
    _totalExecutedShares = 0L
    _totalShortfallDollars = 0.0
  }
}
