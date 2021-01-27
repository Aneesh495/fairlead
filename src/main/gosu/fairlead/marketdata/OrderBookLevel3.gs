package fairlead.marketdata

uses fairlead.model.Side
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses java.util.Map
uses java.util.HashMap
uses java.util.LinkedHashMap
uses java.util.List
uses java.util.ArrayList

/**
 * Level 3 order-by-order book maintaining individual order life cycles,
 * discrete FIFO queue priority positions, and event-driven state transitions.
 */
class OrderBookLevel3 {
  static class RestingOrder {
    var _orderId : String as OrderId
    var _side : Side as Side
    var _price : long as Price
    var _quantity : long as Quantity
    var _timestampNs : long as TimestampNs

    construct(id : String, side : Side, px : long, qty : long, timeNs : long) {
      _orderId = id
      _side = side
      _price = px
      _quantity = qty
      _timestampNs = timeNs
    }
  }

  var _venue : VenueId as Venue
  var _symbol : String as Symbol
  var _orders : Map<String, RestingOrder>
  var _level2Book : OrderBookLevel2 as Level2View
  // Queue tracking: Price -> LinkedHashMap<OrderId, RestingOrder>
  var _bidQueues : Map<Long, LinkedHashMap<String, RestingOrder>>
  var _askQueues : Map<Long, LinkedHashMap<String, RestingOrder>>

  construct(venue : VenueId, symbol : String) {
    _venue = venue
    _symbol = symbol
    _orders = new HashMap<String, RestingOrder>()
    _level2Book = new OrderBookLevel2(venue, symbol)
    _bidQueues = new HashMap<Long, LinkedHashMap<String, RestingOrder>>()
    _askQueues = new HashMap<Long, LinkedHashMap<String, RestingOrder>>()
  }

  public function addOrder(orderId : String, side : Side, price : long, qty : long, timeNs : long, seq : long) {
    var order = new RestingOrder(orderId, side, price, qty, timeNs)
    _orders.put(orderId, order)

    var queues = side == Side.BUY ? _bidQueues : _askQueues
    var queue = queues.get(price)
    if (queue == null) {
      queue = new LinkedHashMap<String, RestingOrder>()
      queues.put(price, queue)
    }
    queue.put(orderId, order)

    recalculateLevel(side, price, timeNs, seq)
  }

  public function executeOrder(orderId : String, executedQty : long, timeNs : long, seq : long) : boolean {
    var order = _orders.get(orderId)
    if (order == null) return false

    order.Quantity = java.lang.Math.max(0L, order.Quantity - executedQty)
    if (order.Quantity == 0L) {
      _orders.remove(orderId)
      var queues = order.Side == Side.BUY ? _bidQueues : _askQueues
      var queue = queues.get(order.Price)
      if (queue != null) {
        queue.remove(orderId)
      }
    }
    recalculateLevel(order.Side, order.Price, timeNs, seq)
    return true
  }

  public function cancelOrder(orderId : String, canceledQty : long, timeNs : long, seq : long) : boolean {
    return executeOrder(orderId, canceledQty, timeNs, seq)
  }

  public function deleteOrder(orderId : String, timeNs : long, seq : long) : boolean {
    var order = _orders.get(orderId)
    if (order == null) return false
    return executeOrder(orderId, order.Quantity, timeNs, seq)
  }

  public function replaceOrder(origId : String, newId : String, newPrice : long, newQty : long, timeNs : long, seq : long) {
    deleteOrder(origId, timeNs, seq)
    addOrder(newId, Side.BUY, newPrice, newQty, timeNs, seq)
  }

  /**
   * Calculates the exact number of shares queued ahead of an order at the same price level.
   */
  public function getQueuePositionAhead(orderId : String) : long {
    var order = _orders.get(orderId)
    if (order == null) return -1L

    var queues = order.Side == Side.BUY ? _bidQueues : _askQueues
    var queue = queues.get(order.Price)
    if (queue == null) return 0L

    var volumeAhead = 0L
    for (entry in queue.entrySet()) {
      if (entry.getKey() == orderId) {
        break
      }
      volumeAhead += entry.getValue().Quantity
    }
    return volumeAhead
  }

  private function recalculateLevel(side : Side, price : long, timeNs : long, seq : long) {
    var queues = side == Side.BUY ? _bidQueues : _askQueues
    var queue = queues.get(price)
    if (queue == null || queue.isEmpty()) {
      queues.remove(price)
      _level2Book.updateLevel(side, price, 0L, 0, timeNs, seq)
    } else {
      var totalQty = 0L
      for (o in queue.values()) {
        totalQty += o.Quantity
      }
      _level2Book.updateLevel(side, price, totalQty, queue.size(), timeNs, seq)
    }
  }

  public property get OrderCount() : int {
    return _orders.size()
  }

  public property get BestBidPrice() : long {
    return _level2Book.BestBidPrice
  }

  public property get BestBidSize() : long {
    return _level2Book.BestBidSize
  }

  public property get BestAskPrice() : long {
    return _level2Book.BestAskPrice
  }

  public property get BestAskSize() : long {
    return _level2Book.BestAskSize
  }

  public function getOrder(orderId : String) : RestingOrder {
    return _orders.get(orderId)
  }

  public function clear() {
    _orders.clear()
    _bidQueues.clear()
    _askQueues.clear()
    _level2Book.clear()
  }
}
