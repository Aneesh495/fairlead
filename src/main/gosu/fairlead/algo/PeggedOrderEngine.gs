package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.OrderType
uses fairlead.model.NBBO
uses fairlead.model.Side
uses fairlead.model.PriceLevel

/**
 * Dynamic Pegged Order tracking engine.
 * Computes continuous resting price adjustments for Midpoint, Primary, and Market pegged orders
 * as the National Best Bid and Offer (NBBO) shifts across lit trading centers.
 */
class PeggedOrderEngine {
  var _minRepriceThresholdPrice : long as MinRepriceThreshold // e.g. 100L = 1 cent threshold

  construct(minRepriceThreshold : long) {
    _minRepriceThresholdPrice = minRepriceThreshold > 0L ? minRepriceThreshold : 100L
  }

  /**
   * Computes the dynamic target peg price for an order given the current NBBO state.
   */
  public function calculatePeggedPrice(order : Order, nbbo : NBBO, tickOffset : long) : long {
    if (order == null || nbbo == null || !nbbo.IsValid) {
      return order != null ? order.LimitPrice : 0L
    }

    var isBuy = order.Side.IsBuy
    var calculatedPx = 0L

    switch (order.OrderType) {
      case PEGGED_MIDPOINT:
        calculatedPx = nbbo.Midpoint + tickOffset
        break

      case PEGGED_PRIMARY:
        // Primary peg: Buy pegs to Best Bid; Sell pegs to Best Ask
        calculatedPx = (isBuy ? nbbo.BestBidPrice : nbbo.BestAskPrice) + (isBuy ? tickOffset : -tickOffset)
        break

      case PEGGED_MARKET:
        // Market peg: Buy pegs to Best Ask; Sell pegs to Best Bid
        calculatedPx = (isBuy ? nbbo.BestAskPrice : nbbo.BestBidPrice) + (isBuy ? tickOffset : -tickOffset)
        break

      default:
        calculatedPx = order.LimitPrice
        break
    }

    // Apply parent limit price ceiling/floor if limit price specified
    if (order.LimitPrice > 0L) {
      if (isBuy) {
        calculatedPx = java.lang.Math.min(calculatedPx, order.LimitPrice)
      } else {
        calculatedPx = java.lang.Math.max(calculatedPx, order.LimitPrice)
      }
    }

    return calculatedPx
  }

  /**
   * Determines whether an active resting order should be cancel-replaced to track an NBBO shift.
   */
  public function shouldReprice(currentRestingPx : long, newCalculatedPx : long) : boolean {
    var delta = java.lang.Math.abs(newCalculatedPx - currentRestingPx)
    return delta >= _minRepriceThresholdPrice
  }
}
