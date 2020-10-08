package fairlead.risk

/**
 * Result of a pre-trade risk compliance validation check under SEC Rule 15c3-5.
 */
class RiskCheckResult {
  var _passed : boolean as Passed
  var _ruleName : String as RuleName
  var _reason : String as Reason
  var _timestampNs : long as TimestampNs

  construct(passed : boolean, rule : String, reason : String) {
    _passed = passed
    _ruleName = rule
    _reason = reason
    _timestampNs = java.lang.System.nanoTime()
  }

  public static function pass(rule : String) : RiskCheckResult {
    return new RiskCheckResult(true, rule, "PASSED")
  }

  public static function fail(rule : String, reason : String) : RiskCheckResult {
    return new RiskCheckResult(false, rule, reason)
  }

  override function toString() : String {
    return _passed ? ("RiskPass[" + _ruleName + "]") : ("RiskReject[" + _ruleName + ": " + _reason + "]")
  }
}
