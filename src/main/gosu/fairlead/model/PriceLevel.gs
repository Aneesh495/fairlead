package fairlead.model

uses java.util.List
uses java.util.ArrayList

/**
 * Fixed-point aggregated price level in a limit order book.
 * Prices are represented as 64-bit signed integers scaled by 10,000 (4 decimal places),
 * preventing IEEE-754 floating point inaccuracies during sub-penny pricing and matching.
 */
class PriceLevel implements java.lang.Comparable<PriceLevel> {
  public static final var PRICE_SCALE : long = 10000L

  var _price : long as Price
  var _totalQuantity : long as TotalQuantity
  var _orderCount : int as OrderCount
  var _orderIds : List<String> as OrderIds

  construct(price : long) {
    _price = price
    _totalQuantity = 0L
    _orderCount = 0
    _orderIds = new ArrayList<String>()
  }

  construct(price : long, quantity : long, count : int) {
    _price = price
    _totalQuantity = quantity
    _orderCount = count
    _orderIds = new ArrayList<String>()
  }

  public function addOrder(orderId : String, qty : long) {
    if (orderId != null) {
      _orderIds.add(orderId)
    }
    _totalQuantity += qty
    _orderCount++
  }

  public function removeOrder(orderId : String, qty : long) : boolean {
    var removed = _orderIds.remove(orderId)
    if (removed || orderId == null) {
      _totalQuantity = java.lang.Math.max(0L, _totalQuantity - qty)
      _orderCount = java.lang.Math.max(0, _orderCount - 1)
      return true
    }
    return false
  }

  public function reduceVolume(qty : long) {
    _totalQuantity = java.lang.Math.max(0L, _totalQuantity - qty)
    if (_totalQuantity == 0L) {
      _orderCount = 0
      _orderIds.clear()
    }
  }

  public function toDouble() : double {
    return (_price as double) / (PRICE_SCALE as double)
  }

  public static function fromDouble(val : double) : long {
    return java.lang.Math.round(val * (PRICE_SCALE as double))
  }

  public function formatPrice() : String {
    var whole = _price / PRICE_SCALE
    var frac = java.lang.Math.abs(_price % PRICE_SCALE)
    return java.lang.String.format("%d.%04d", new Object[]{whole, frac})
  }

  override function compareTo(other : PriceLevel) : int {
    if (other == null) return 1
    return java.lang.Long.compare(_price, other.Price)
  }

  override function toString() : String {
    return "PriceLevel[" + formatPrice() + " x " + _totalQuantity + " (" + _orderCount + " orders)]"
  }
}
