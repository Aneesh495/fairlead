package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses fairlead.marketdata.feed.SIPFeedHandler.LULDBand
uses java.util.Map
uses java.util.concurrent.ConcurrentHashMap

/**
 * Limit-Up / Limit-Down (LULD) Risk Filter.
 * NMS Plan to Address Extraordinary Market Volatility.
 * Validates that outbound buy orders are not priced above the Upper Price Band,
 * and outbound sell orders are not priced below the Lower Price Band.
 */
class LimitUpLimitDownFilter implements IRiskFilter {
  private var _priceBands : Map<String, LULDBand>

  public construct() {
    _priceBands = new ConcurrentHashMap<String, LULDBand>()
  }

  public property get FilterName() : String {
    return "NMS_PLAN_LULD_PRICE_BAND_FILTER"
  }

  public function setBands(symbol : String, band : LULDBand) {
    _priceBands.put(symbol, band)
  }

  public function setBands(symbol : String, lowerMicroPrice : long, upperMicroPrice : long) {
    _priceBands.put(symbol, new LULDBand(lowerMicroPrice, upperMicroPrice, System.currentTimeMillis()))
  }

  override public function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult {
    var band = _priceBands.get(order.Symbol)
    if (band == null) {
      return RiskCheckResult.pass(FilterName)
    }

    // Limit Buy orders must not exceed the upper price band
    if (order.Side == Side.BUY) {
      if (order.LimitPrice > band.UpperPrice) {
        return RiskCheckResult.fail(
          FilterName,
          "LULD Upper Band violation: Buy order limit $" + order.LimitPriceDouble +
          " exceeds Upper Price Band $" + band.UpperPriceDouble
        )
      }
    } else if (order.Side == Side.SELL || order.Side == Side.SELL_SHORT) {
      // Sell orders must not be below the lower price band
      if (order.LimitPrice < band.LowerPrice) {
        return RiskCheckResult.fail(
          FilterName,
          "LULD Lower Band violation: Sell order limit $" + order.LimitPriceDouble +
          " is below Lower Price Band $" + band.LowerPriceDouble
        )
      }
    }

    return RiskCheckResult.pass(FilterName)
  }
}
