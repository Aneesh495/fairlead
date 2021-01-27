package fairlead.model

uses java.util.List
uses java.util.ArrayList

/**
 * Order entity supporting parent/child hierarchies, atomic state machine transitions,
 * and execution fill tracking with nanosecond audit timestamps.
 */
class Order {
  var _orderId : String as OrderId
  var _clOrdId : String as ClOrdId
  var _origClOrdId : String as OrigClOrdId
  var _parentOrderId : String as ParentOrderId
  var _symbol : String as Symbol
  var _side : Side as Side
  var _orderType : OrderType as OrderType
  var _timeInForce : TimeInForce as TimeInForce
  var _limitPrice : long as LimitPrice
  var _quantity : long as Quantity
  var _leavesQuantity : long as LeavesQuantity
  var _cumQuantity : long as CumQuantity
  var _avgPrice : double as AvgPrice
  var _status : OrderStatus as Status
  var _targetVenue : VenueId as TargetVenue
  var _createTimeNs : long as CreateTimeNs
  var _updateTimeNs : long as UpdateTimeNs
  var _account : String as Account
  var _traderId : String as TraderId
  var _strategyTag : String as StrategyTag
  var _childOrders : List<Order> as ChildOrders

  construct(orderId : String, clOrdId : String, symbol : String, side : Side,
            type : OrderType, tif : TimeInForce, limitPx : long, qty : long,
            account : String, traderId : String, strategy : String) {
    _orderId = orderId
    _clOrdId = clOrdId
    _symbol = symbol
    _side = side
    _orderType = type
    _timeInForce = tif
    _limitPrice = limitPx
    _quantity = qty
    _leavesQuantity = qty
    _cumQuantity = 0L
    _avgPrice = 0.0
    _status = OrderStatus.PENDING_NEW
    _targetVenue = null
    _createTimeNs = java.lang.System.nanoTime()
    _updateTimeNs = _createTimeNs
    _account = account
    _traderId = traderId
    _strategyTag = strategy
    _childOrders = new ArrayList<Order>()
  }

  public function createChildSlice(childId : String, childClOrdId : String, venue : VenueId, sliceQty : long, slicePx : long) : Order {
    var child = new Order(childId, childClOrdId, _symbol, _side, _orderType, _timeInForce, slicePx, sliceQty, _account, _traderId, _strategyTag)
    child.ParentOrderId = _orderId
    child.TargetVenue = venue
    child.Status = OrderStatus.PENDING_NEW
    _childOrders.add(child)
    return child
  }

  public function transitionStatus(target : OrderStatus) : boolean {
    if (_status.canTransitionTo(target)) {
      _status = target
      _updateTimeNs = java.lang.System.nanoTime()
      return true
    }
    return false
  }

  public function recordFill(filledQty : long, fillPx : double) {
    if (filledQty <= 0L) return
    var oldCum = _cumQuantity
    var newCum = oldCum + filledQty
    _cumQuantity = newCum
    _leavesQuantity = java.lang.Math.max(0L, _quantity - newCum)
    _avgPrice = ((_avgPrice * (oldCum as double)) + (fillPx * (filledQty as double))) / (newCum as double)
    _updateTimeNs = java.lang.System.nanoTime()

    if (_leavesQuantity == 0L) {
      _status = OrderStatus.FILLED
    } else {
      _status = OrderStatus.PARTIALLY_FILLED
    }
  }

  public property get IsParent() : boolean {
    return _parentOrderId == null
  }

  public property get IsChild() : boolean {
    return _parentOrderId != null
  }

  public property get LimitPriceDouble() : double {
    return (_limitPrice as double) / (PriceLevel.PRICE_SCALE as double)
  }

  public property get TotalNotionalValue() : double {
    var px = (_limitPrice as double) / (PriceLevel.PRICE_SCALE as double)
    return px * (_quantity as double)
  }

  public property get LeavesNotionalValue() : double {
    var px = (_limitPrice as double) / (PriceLevel.PRICE_SCALE as double)
    return px * (_leavesQuantity as double)
  }

  override function toString() : String {
    return "Order[" + _orderId + " (" + _clOrdId + ") " + _side + " " + _quantity + " " + _symbol +
           " @ " + (_limitPrice as double)/10000.0 + " status=" + _status + " leaves=" + _leavesQuantity + "]"
  }
}
