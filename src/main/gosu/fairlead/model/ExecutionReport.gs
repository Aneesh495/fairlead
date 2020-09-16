package fairlead.model

/**
 * Execution report representing venue fill notices, partial executions, rejections,
 * liquidity flags, and transaction fee/rebate attributions.
 */
class ExecutionReport {
  var _execId : String as ExecId
  var _orderId : String as OrderId
  var _clOrdId : String as ClOrdId
  var _symbol : String as Symbol
  var _side : Side as Side
  var _lastShares : long as LastShares
  var _lastPx : double as LastPx
  var _cumShares : long as CumShares
  var _leavesShares : long as LeavesShares
  var _avgPx : double as AvgPx
  var _status : OrderStatus as Status
  var _venue : VenueId as Venue
  var _liquidityFlag : String as LiquidityFlag // "ADDED" (Maker), "REMOVED" (Taker), "ROUTED"
  var _feeOrRebate : double as FeeOrRebate     // Positive represents fee cost; negative represents rebate credit
  var _timestampNs : long as TimestampNs
  var _text : String as Text

  construct(execId : String, orderId : String, clOrdId : String, symbol : String, side : Side,
            lastQty : long, lastPx : double, cumQty : long, leavesQty : long, avgPx : double,
            status : OrderStatus, venue : VenueId, liq : String, fee : double, text : String) {
    _execId = execId
    _orderId = orderId
    _clOrdId = clOrdId
    _symbol = symbol
    _side = side
    _lastShares = lastQty
    _lastPx = lastPx
    _cumShares = cumQty
    _leavesShares = leavesQty
    _avgPx = avgPx
    _status = status
    _venue = venue
    _liquidityFlag = liq
    _feeOrRebate = fee
    _timestampNs = java.lang.System.nanoTime()
    _text = text
  }

  public property get IsFill() : boolean {
    return _lastShares > 0L && (_status == OrderStatus.FILLED || _status == OrderStatus.PARTIALLY_FILLED)
  }

  public property get IsMaker() : boolean {
    return _liquidityFlag != null && (_liquidityFlag == "ADDED" || _liquidityFlag == "A" || _liquidityFlag == "MAKER")
  }

  public property get IsTaker() : boolean {
    return _liquidityFlag != null && (_liquidityFlag == "REMOVED" || _liquidityFlag == "R" || _liquidityFlag == "TAKER")
  }

  public property get PrincipalTraded() : double {
    return (_lastShares as double) * _lastPx
  }

  public property get NetMoney() : double {
    return PrincipalTraded + _feeOrRebate
  }

  override function toString() : String {
    return "ExecReport[" + _execId + " " + _status + " " + _side + " " + _lastShares + "@" + _lastPx +
           " on " + _venue + " liq=" + _liquidityFlag + " fee=" + _feeOrRebate + "]"
  }
}
