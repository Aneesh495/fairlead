package fairlead.model

/**
 * Top-of-book quote update emitted by an exchange or ATS venue.
 * Contains bid/ask prices in 4-decimal fixed point, queue sizes, and nanosecond timestamps.
 */
class Quote {
  var _venue : VenueId as Venue
  var _symbol : String as Symbol
  var _bidPrice : long as BidPrice
  var _bidSize : long as BidSize
  var _askPrice : long as AskPrice
  var _askSize : long as AskSize
  var _timestampNs : long as TimestampNs
  var _sequenceNumber : long as SequenceNumber

  construct(venue : VenueId, symbol : String, bidPx : long, bidSz : long, askPx : long, askSz : long, timeNs : long, seq : long) {
    _venue = venue
    _symbol = symbol
    _bidPrice = bidPx
    _bidSize = bidSz
    _askPrice = askPx
    _askSize = askSz
    _timestampNs = timeNs
    _sequenceNumber = seq
  }

  public property get Spread() : long {
    return _askPrice - _bidPrice
  }

  public property get Midpoint() : long {
    return (_bidPrice + _askPrice) / 2L
  }

  public property get IsLocked() : boolean {
    return _bidPrice > 0L && _askPrice > 0L && _bidPrice == _askPrice
  }

  public property get IsCrossed() : boolean {
    return _bidPrice > 0L && _askPrice > 0L && _bidPrice > _askPrice
  }

  public property get IsValid() : boolean {
    return _bidPrice > 0L && _askPrice > 0L && _bidSize > 0L && _askSize > 0L && !IsCrossed
  }

  /**
   * Computes the order-flow weighted micro-price:
   * P_micro = (P_bid * Q_ask + P_ask * Q_bid) / (Q_bid + Q_ask)
   */
  public property get MicroPrice() : double {
    var totalSize = _bidSize + _askSize
    if (totalSize == 0L) {
      return (Midpoint as double) / (PriceLevel.PRICE_SCALE as double)
    }
    var bidPxDouble = (_bidPrice as double) / (PriceLevel.PRICE_SCALE as double)
    var askPxDouble = (_askPrice as double) / (PriceLevel.PRICE_SCALE as double)
    return (bidPxDouble * (_askSize as double) + askPxDouble * (_bidSize as double)) / (totalSize as double)
  }

  override function toString() : String {
    return "Quote[" + _venue + " " + _symbol + " " + _bidSize + "@" + (_bidPrice as double)/10000.0 +
           " x " + (_askPrice as double)/10000.0 + "@" + _askSize + " seq=" + _sequenceNumber + "]"
  }
}
