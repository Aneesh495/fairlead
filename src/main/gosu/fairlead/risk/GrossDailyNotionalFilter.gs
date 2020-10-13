package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses java.util.Map
uses java.util.HashMap

/**
 * Tracks and limits the cumulative gross daily traded and committed notional value
 * across all symbols for an institutional trading account under Rule 15c3-5.
 */
class GrossDailyNotionalFilter implements IRiskFilter {
  var _maxGrossDailyNotional : double as MaxGrossDailyNotional
  var _accountGrossNotionalMap : Map<String, Double> as AccountGrossMap

  construct(maxGrossDailyNotional : double) {
    _maxGrossDailyNotional = maxGrossDailyNotional
    _accountGrossNotionalMap = new HashMap<String, Double>()
  }

  override property get FilterName() : String {
    return "GROSS_DAILY_NOTIONAL"
  }

  public function getAccountCurrentGross(account : String) : double {
    var current = _accountGrossNotionalMap.get(account)
    return current != null ? current : 0.0
  }

  public function recordOrderCommitment(order : Order) {
    if (order == null || order.Account == null) return
    var current = getAccountCurrentGross(order.Account)
    _accountGrossNotionalMap.put(order.Account, current + order.TotalNotionalValue)
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) return RiskCheckResult.fail(FilterName, "Order is null")
    var account = order.Account != null ? order.Account : "DEFAULT"
    var currentGross = getAccountCurrentGross(account)
    var proposedGross = currentGross + order.TotalNotionalValue

    if (proposedGross > _maxGrossDailyNotional) {
      return RiskCheckResult.fail(FilterName, "Proposed daily gross $" + java.lang.String.format("%.2f", new Object[]{proposedGross}) +
                                              " exceeds limit $" + java.lang.String.format("%.2f", new Object[]{_maxGrossDailyNotional}))
    }

    return RiskCheckResult.pass(FilterName)
  }

  public function reset() {
    _accountGrossNotionalMap.clear()
  }
}
