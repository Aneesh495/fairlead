package fairlead.model

uses java.util.List
uses java.util.ArrayList

/**
 * Consolidated National Best Bid and Offer (NBBO) aggregate across all active Reg NMS lit venues.
 * Tracks multi-venue tie priority, locked/crossed state, and order-book micro-price.
 */
class NBBO {
  var _symbol : String as Symbol
  var _bestBidPrice : long as BestBidPrice
  var _bestBidSize : long as BestBidSize
  var _bestBidVenues : List<VenueId> as BestBidVenues
  var _bestAskPrice : long as BestAskPrice
  var _bestAskSize : long as BestAskSize
  var _bestAskVenues : List<VenueId> as BestAskVenues
  var _timestampNs : long as TimestampNs
  var _sequenceNumber : long as SequenceNumber

  construct(symbol : String, bidPx : long, bidSz : long, bidVenues : List<VenueId>,
            askPx : long, askSz : long, askVenues : List<VenueId>, timeNs : long, seq : long) {
    _symbol = symbol
    _bestBidPrice = bidPx
    _bestBidSize = bidSz
    _bestBidVenues = bidVenues != null ? bidVenues : new ArrayList<VenueId>()
    _bestAskPrice = askPx
    _bestAskSize = askSz
    _bestAskVenues = askVenues != null ? askVenues : new ArrayList<VenueId>()
    _timestampNs = timeNs
    _sequenceNumber = seq
  }

  public property get Spread() : long {
    return _bestAskPrice - _bestBidPrice
  }

  public property get Midpoint() : long {
    return (_bestBidPrice + _bestAskPrice) / 2L
  }

  public property get IsLocked() : boolean {
    return _bestBidPrice > 0L && _bestAskPrice > 0L && _bestBidPrice == _bestAskPrice
  }

  public property get IsCrossed() : boolean {
    return _bestBidPrice > 0L && _bestAskPrice > 0L && _bestBidPrice > _bestAskPrice
  }

  public property get IsValid() : boolean {
    return _bestBidPrice > 0L && _bestAskPrice > 0L && _bestBidSize > 0L && _bestAskSize > 0L && !IsCrossed
  }

  public property get MicroPrice() : double {
    var total = _bestBidSize + _bestAskSize
    if (total == 0L) {
      return (Midpoint as double) / (PriceLevel.PRICE_SCALE as double)
    }
    var bidDouble = (_bestBidPrice as double) / (PriceLevel.PRICE_SCALE as double)
    var askDouble = (_bestAskPrice as double) / (PriceLevel.PRICE_SCALE as double)
    return (bidDouble * (_bestAskSize as double) + askDouble * (_bestBidSize as double)) / (total as double)
  }

  public function hasBidVenue(v : VenueId) : boolean {
    return _bestBidVenues.contains(v)
  }

  public function hasAskVenue(v : VenueId) : boolean {
    return _bestAskVenues.contains(v)
  }

  public function formatNBBO() : String {
    var bidPx = (_bestBidPrice as double) / 10000.0
    var askPx = (_bestAskPrice as double) / 10000.0
    return _bestBidSize + "@" + bidPx + " [" + _bestBidVenues.size() + "v] x [" +
           _bestAskVenues.size() + "v] " + askPx + "@" + _bestAskSize +
           (IsLocked ? " (LOCKED)" : (IsCrossed ? " (CROSSED)" : ""))
  }

  override function toString() : String {
    return "NBBO[" + _symbol + " " + formatNBBO() + " seq=" + _sequenceNumber + "]"
  }
}
