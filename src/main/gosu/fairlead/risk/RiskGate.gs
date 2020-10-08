package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses java.util.List
uses java.util.ArrayList

/**
 * SEC Rule 15c3-5 Market Access pre-trade risk validation gate.
 * Executes a deterministic pipeline of credit, notional, collar, and wash-sale filters
 * with sub-microsecond evaluation latency prior to any outbound venue routing.
 */
class RiskGate {
  var _filters : List<IRiskFilter> as Filters
  var _totalChecksEvaluated : long as TotalChecksEvaluated
  var _totalOrdersRejected : long as TotalOrdersRejected

  construct() {
    _filters = new ArrayList<IRiskFilter>()
    _totalChecksEvaluated = 0L
    _totalOrdersRejected = 0L
  }

  public function addFilter(filter : IRiskFilter) : RiskGate {
    if (filter != null) {
      _filters.add(filter)
    }
    return this
  }

  /**
   * Evaluates order against all configured risk filters sequentially.
   * Short-circuits immediately upon the first violation.
   */
  public function validate(order : Order, nbbo : NBBO) : RiskCheckResult {
    _totalChecksEvaluated++

    for (filter in _filters) {
      var result = filter.evaluate(order, nbbo)
      if (!result.Passed) {
        _totalOrdersRejected++
        return result
      }
    }

    return RiskCheckResult.pass("ALL_FILTERS")
  }

  public function clear() {
    _filters.clear()
    _totalChecksEvaluated = 0L
    _totalOrdersRejected = 0L
  }
}
