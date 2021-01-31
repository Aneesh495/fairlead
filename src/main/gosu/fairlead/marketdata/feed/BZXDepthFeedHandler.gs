package fairlead.marketdata.feed

uses fairlead.marketdata.OrderBookLevel3
uses fairlead.model.Side
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses java.util.Map
uses java.util.concurrent.ConcurrentHashMap

/**
 * Cboe BZX Depth Feed Handler (PITCH protocol parser).
 * Processes direct exchange binary order lifecycle events:
 * Add Order, Order Executed, Order Cancel, and Order Delete.
 */
class BZXDepthFeedHandler {
  private var _booksBySymbol : Map<String, OrderBookLevel3>

  public construct() {
    _booksBySymbol = new ConcurrentHashMap<String, OrderBookLevel3>()
  }

  public function getOrCreateBook(symbol : String) : OrderBookLevel3 {
    var b = _booksBySymbol.get(symbol)
    if (b == null) {
      b = new OrderBookLevel3(VenueId.BATS, symbol)
      _booksBySymbol.put(symbol, b)
    }
    return b
  }

  /**
   * PITCH Add Order Message (Long/Short Form).
   */
  public function onAddOrder(symbol : String, orderId : long, side : Side, quantity : long, price : long, timestamp : long) {
    var book = getOrCreateBook(symbol)
    book.addOrder(String.valueOf(orderId), side, price, quantity, timestamp, 1L)
  }

  /**
   * PITCH Order Executed Message (partial or full fill).
   */
  public function onOrderExecuted(symbol : String, orderId : long, executedShares : long, executionId : long) {
    var book = _booksBySymbol.get(symbol)
    if (book != null) {
      book.executeOrder(String.valueOf(orderId), executedShares, System.nanoTime(), 1L)
    }
  }

  /**
   * PITCH Order Cancel Message (reduces shares of an active order).
   */
  public function onOrderCancel(symbol : String, orderId : long, canceledShares : long) {
    var book = _booksBySymbol.get(symbol)
    if (book != null) {
      book.cancelOrder(String.valueOf(orderId), canceledShares, System.nanoTime(), 1L)
    }
  }

  /**
   * PITCH Order Delete Message (removes the order entirely).
   */
  public function onOrderDelete(symbol : String, orderId : long) {
    var book = _booksBySymbol.get(symbol)
    if (book != null) {
      book.deleteOrder(String.valueOf(orderId), System.nanoTime(), 1L)
    }
  }

  public function getBook(symbol : String) : OrderBookLevel3 {
    return _booksBySymbol.get(symbol)
  }
}
