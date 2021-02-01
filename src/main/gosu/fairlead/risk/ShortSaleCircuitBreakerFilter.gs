package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses java.util.Map
uses java.util.concurrent.ConcurrentHashMap

/**
 * SEC Rule 201 Short Sale Circuit Breaker Risk Filter (Alternative Uptick Rule).
 * When triggered (e.g. >= 10% decline from previous close), short sale orders
 * cannot be routed or displayed at or below the current National Best Bid,
 * unless marked as Short Sale Exempt (SSX).
 */
class ShortSaleCircuitBreakerFilter implements IRiskFilter {
  private var _circuitBreakerActive : Map<String, Boolean>

  public construct() {
    _circuitBreakerActive = new ConcurrentHashMap<String, Boolean>()
  }

  public property get FilterName() : String {
    return "SEC_RULE_201_SHORT_SALE_CIRCUIT_BREAKER"
  }

  /**
   * Activates or deactivates Rule 201 restriction for a symbol.
   */
  public function setCircuitBreaker(symbol : String, active : boolean) {
    _circuitBreakerActive.put(symbol, Boolean.valueOf(active))
  }

  public function isCircuitBreakerActive(symbol : String) : boolean {
    var a = _circuitBreakerActive.get(symbol)
    return a != null && a.booleanValue()
  }

  override public function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    // Only applies to sell short orders
    if (order.Side != Side.SELL_SHORT) {
      return RiskCheckResult.pass(FilterName)
    }

    if (!isCircuitBreakerActive(order.Symbol)) {
      return RiskCheckResult.pass(FilterName)
    }

    if (nbbo == null || !nbbo.IsValid) {
      return RiskCheckResult.pass(FilterName)
    }

    // Under Rule 201, short sale order must be strictly priced above the National Best Bid
    var bestBid = nbbo.BestBidPrice
    if (order.LimitPrice <= bestBid) {
      return RiskCheckResult.fail(
        FilterName,
        "SEC Rule 201 violation: Short sale limit price $" + order.LimitPriceDouble +
        " is not strictly above National Best Bid $" + ((bestBid as double) / 10000.0) +
        " during active circuit breaker"
      )
    }

    return RiskCheckResult.pass(FilterName)
  }
}
