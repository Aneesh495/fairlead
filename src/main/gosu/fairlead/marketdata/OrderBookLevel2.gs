package fairlead.marketdata

uses fairlead.model.Side
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel
uses java.util.TreeMap
uses java.util.Collections
uses java.util.List
uses java.util.ArrayList

/**
 * Level 2 aggregated limit order book maintaining discrete price ladders for bids and asks.
 * Bids are ordered descending by price (highest bid first); asks are ordered ascending
 * by price (lowest ask first) with sub-microsecond level lookups and depth-of-book slicing.
 */
class OrderBookLevel2 {
  var _venue : VenueId as Venue
  var _symbol : String as Symbol
  var _bids : TreeMap<Long, PriceLevel>
  var _asks : TreeMap<Long, PriceLevel>
  var _lastUpdateNs : long as LastUpdateNs
  var _sequenceNumber : long as SequenceNumber

  construct(venue : VenueId, symbol : String) {
    _venue = venue
    _symbol = symbol
    // Bids sorted in descending order: highest price first
    _bids = new TreeMap<Long, PriceLevel>(Collections.reverseOrder())
    // Asks sorted in natural ascending order: lowest price first
    _asks = new TreeMap<Long, PriceLevel>()
    _lastUpdateNs = java.lang.System.nanoTime()
    _sequenceNumber = 0L
  }

  public function updateLevel(side : Side, price : long, quantity : long, count : int, timeNs : long, seq : long) {
    var ladder = side == Side.BUY ? _bids : _asks
    if (quantity <= 0L) {
      ladder.remove(price)
    } else {
      var existing = ladder.get(price)
      if (existing != null) {
        existing.TotalQuantity = quantity
        existing.OrderCount = count
      } else {
        ladder.put(price, new PriceLevel(price, quantity, count))
      }
    }
    _lastUpdateNs = timeNs
    _sequenceNumber = seq
  }

  public function removeLevel(side : Side, price : long) {
    var ladder = side == Side.BUY ? _bids : _asks
    ladder.remove(price)
    _lastUpdateNs = java.lang.System.nanoTime()
  }

  public property get BestBid() : PriceLevel {
    if (_bids.isEmpty()) return null
    return _bids.firstEntry().getValue()
  }

  public property get BestAsk() : PriceLevel {
    if (_asks.isEmpty()) return null
    return _asks.firstEntry().getValue()
  }

  public property get BestBidPrice() : long {
    var b = BestBid
    return b != null ? b.Price : 0L
  }

  public property get BestAskPrice() : long {
    var a = BestAsk
    return a != null ? a.Price : 0L
  }

  public property get BestBidSize() : long {
    var b = BestBid
    return b != null ? b.TotalQuantity : 0L
  }

  public property get BestAskSize() : long {
    var a = BestAsk
    return a != null ? a.TotalQuantity : 0L
  }

  public function getBidDepth(maxLevels : int) : List<PriceLevel> {
    var list = new ArrayList<PriceLevel>()
    var count = 0
    for (entry in _bids.entrySet()) {
      if (count >= maxLevels) break
      list.add(entry.getValue())
      count++
    }
    return list
  }

  public function getAskDepth(maxLevels : int) : List<PriceLevel> {
    var list = new ArrayList<PriceLevel>()
    var count = 0
    for (entry in _asks.entrySet()) {
      if (count >= maxLevels) break
      list.add(entry.getValue())
      count++
    }
    return list
  }

  /**
   * Calculates the cumulative quantity available on the book up to or at a limit price.
   */
  public function getAvailableVolumeUpTo(side : Side, limitPrice : long) : long {
    var totalVolume = 0L
    if (side == Side.BUY) {
      // For a buyer taking liquidity from the ask ladder: ask <= limitPrice
      for (entry in _asks.entrySet()) {
        if (entry.getKey() <= limitPrice) {
          totalVolume += entry.getValue().TotalQuantity
        } else {
          break
        }
      }
    } else {
      // For a seller taking liquidity from the bid ladder: bid >= limitPrice
      for (entry in _bids.entrySet()) {
        if (entry.getKey() >= limitPrice) {
          totalVolume += entry.getValue().TotalQuantity
        } else {
          break
        }
      }
    }
    return totalVolume
  }

  /**
   * Computes the volume-weighted average price to execute requestedQty against the book.
   */
  public function computeBookVWAP(side : Side, requestedQty : long) : double {
    if (requestedQty <= 0L) return 0.0
    var ladder = side == Side.BUY ? _asks : _bids
    var remaining = requestedQty
    var accumulatedNotional = 0.0
    var executedQty = 0L

    for (entry in ladder.entrySet()) {
      var levelPx = (entry.getKey() as double) / (PriceLevel.PRICE_SCALE as double)
      var levelQty = entry.getValue().TotalQuantity
      var take = java.lang.Math.min(remaining, levelQty)
      accumulatedNotional += levelPx * (take as double)
      executedQty += take
      remaining -= take
      if (remaining == 0L) break
    }

    return executedQty > 0L ? (accumulatedNotional / (executedQty as double)) : 0.0
  }

  public function clear() {
    _bids.clear()
    _asks.clear()
    _sequenceNumber = 0L
  }

  override function toString() : String {
    var bb = BestBid
    var ba = BestAsk
    var bidStr = bb != null ? (bb.TotalQuantity + "@" + bb.toDouble()) : "NONE"
    var askStr = ba != null ? (ba.toDouble() + "@" + ba.TotalQuantity) : "NONE"
    return "BookL2[" + _venue + " " + _symbol + " " + bidStr + " x " + askStr + " seq=" + _sequenceNumber + "]"
  }
}
