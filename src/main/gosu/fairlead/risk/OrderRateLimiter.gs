package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO

/**
 * Token-bucket algorithm rate limiter protecting exchange connections from runaway client loops
 * and message throttle breaches under SEC Rule 15c3-5.
 */
class OrderRateLimiter implements IRiskFilter {
  var _maxTokens : double as MaxTokens
  var _refillRatePerSec : double as RefillRatePerSec
  var _availableTokens : double as AvailableTokens
  var _lastRefillTimeNs : long as LastRefillTimeNs

  construct(maxTokens : double, refillRatePerSec : double) {
    _maxTokens = maxTokens
    _refillRatePerSec = refillRatePerSec
    _availableTokens = maxTokens
    _lastRefillTimeNs = java.lang.System.nanoTime()
  }

  override property get FilterName() : String {
    return "ORDER_RATE_LIMITER"
  }

  private function refill() {
    var now = java.lang.System.nanoTime()
    var elapsedSec = ((now - _lastRefillTimeNs) as double) / 1000000000.0
    if (elapsedSec > 0.0) {
      _availableTokens = java.lang.Math.min(_maxTokens, _availableTokens + (elapsedSec * _refillRatePerSec))
      _lastRefillTimeNs = now
    }
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    refill()
    if (_availableTokens >= 1.0) {
      _availableTokens = _availableTokens - 1.0
      return RiskCheckResult.pass(FilterName)
    }
    return RiskCheckResult.fail(FilterName, "Order rate limit breached: insufficient token capacity (tokens=" +
                                            java.lang.String.format("%.2f", new Object[]{_availableTokens}) + ")")
  }

  public function reset() {
    _availableTokens = _maxTokens
    _lastRefillTimeNs = java.lang.System.nanoTime()
  }
}
