package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses java.util.Map
uses java.util.HashMap

/**
 * Dynamic credit line and capital allocation manager with multi-tier soft warning
 * thresholds and hard pre-trade blockage gates.
 */
class CreditThresholdManager implements IRiskFilter {
  static class AccountCredit {
    var _limitDollars : double as LimitDollars
    var _utilizedDollars : double as UtilizedDollars
    var _softThresholdPct : double as SoftThresholdPct

    construct(limit : double, softPct : double) {
      _limitDollars = limit
      _utilizedDollars = 0.0
      _softThresholdPct = softPct
    }

    public property get AvailableDollars() : double {
      return java.lang.Math.max(0.0, _limitDollars - _utilizedDollars)
    }

    public property get UtilizationPct() : double {
      return _limitDollars > 0.0 ? (_utilizedDollars / _limitDollars) : 1.0
    }

    public property get IsSoftThresholdBreached() : boolean {
      return UtilizationPct >= _softThresholdPct
    }
  }

  var _accounts : Map<String, AccountCredit> as Accounts

  construct() {
    _accounts = new HashMap<String, AccountCredit>()
  }

  override property get FilterName() : String {
    return "CREDIT_THRESHOLD"
  }

  public function configureAccount(account : String, limitDollars : double, softThresholdPct : double) {
    _accounts.put(account, new AccountCredit(limitDollars, softThresholdPct))
  }

  public function getAccount(account : String) : AccountCredit {
    return _accounts.get(account)
  }

  public function recordUtilization(account : String, notionalDollars : double) {
    var cred = _accounts.get(account)
    if (cred != null) {
      cred.UtilizedDollars = cred.UtilizedDollars + notionalDollars
    }
  }

  override function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    if (order == null) return RiskCheckResult.fail(FilterName, "Order is null")
    var account = order.Account != null ? order.Account : "DEFAULT"
    var cred = _accounts.get(account)
    if (cred == null) {
      // Unconfigured accounts pass by default if no credit line assigned
      return RiskCheckResult.pass(FilterName)
    }

    var orderNotional = order.TotalNotionalValue
    if (cred.UtilizedDollars + orderNotional > cred.LimitDollars) {
      return RiskCheckResult.fail(FilterName, "Credit line breached for account " + account +
                                              ": required $" + java.lang.String.format("%.2f", new Object[]{orderNotional}) +
                                              ", available $" + java.lang.String.format("%.2f", new Object[]{cred.AvailableDollars}))
    }

    return RiskCheckResult.pass(FilterName)
  }

  public function clear() {
    _accounts.clear()
  }
}
