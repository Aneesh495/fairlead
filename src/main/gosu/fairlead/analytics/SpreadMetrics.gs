package fairlead.analytics

uses fairlead.model.Side

/**
 * SEC Rule 605 market microstructure execution quality spread metrics calculator.
 * Computes Effective Spread, Realized Spread, and Price Impact across multi-venue fills.
 */
class SpreadMetrics {
  static class SpreadRecord {
    var _orderId : String as OrderId
    var _side : Side as Side
    var _tradePrice : double as TradePrice
    var _tradeMidpoint : double as TradeMidpoint
    var _subsequentMidpoint : double as SubsequentMidpoint
    var _effectiveSpreadDollars : double as EffectiveSpreadDollars
    var _effectiveSpreadBps : double as EffectiveSpreadBps
    var _realizedSpreadDollars : double as RealizedSpreadDollars
    var _realizedSpreadBps : double as RealizedSpreadBps
    var _priceImpactDollars : double as PriceImpactDollars
    var _priceImpactBps : double as PriceImpactBps

    construct(id : String, side : Side, tradePx : double, tradeMid : double, postMid : double) {
      _orderId = id
      _side = side
      _tradePrice = tradePx
      _tradeMidpoint = tradeMid
      _subsequentMidpoint = postMid

      compute()
    }

    private function compute() {
      var d = _side.sign() as double // +1 for Buy, -1 for Sell
      // Effective Spread = 2 * D * (P_trade - M_trade)
      _effectiveSpreadDollars = 2.0 * d * (_tradePrice - _tradeMidpoint)
      _effectiveSpreadBps = _tradeMidpoint > 0.0 ? ((_effectiveSpreadDollars / _tradeMidpoint) * 10000.0) : 0.0

      if (_subsequentMidpoint > 0.0) {
        // Realized Spread = 2 * D * (P_trade - M_post)
        _realizedSpreadDollars = 2.0 * d * (_tradePrice - _subsequentMidpoint)
        _realizedSpreadBps = _tradeMidpoint > 0.0 ? ((_realizedSpreadDollars / _tradeMidpoint) * 10000.0) : 0.0

        // Price Impact = Effective Spread - Realized Spread = 2 * D * (M_post - M_trade)
        _priceImpactDollars = _effectiveSpreadDollars - _realizedSpreadDollars
        _priceImpactBps = _tradeMidpoint > 0.0 ? ((_priceImpactDollars / _tradeMidpoint) * 10000.0) : 0.0
      }
    }
  }

  public static function evaluateSpread(orderId : String, side : Side, tradePx : double,
                                        tradeMid : double, postMid : double) : SpreadRecord {
    return new SpreadRecord(orderId, side, tradePx, tradeMid, postMid)
  }
}
