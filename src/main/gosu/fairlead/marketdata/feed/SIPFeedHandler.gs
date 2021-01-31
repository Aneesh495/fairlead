package fairlead.marketdata.feed

uses fairlead.model.PriceLevel
uses fairlead.model.Quote
uses fairlead.model.Side
uses fairlead.model.VenueId
uses fairlead.marketdata.MarketDataFeedHandler
uses java.util.Map
uses java.util.HashMap
uses java.util.concurrent.ConcurrentHashMap

/**
 * Securities Information Processor (SIP) Feed Handler.
 * Ingests consolidated tape data feeds (CTA/CQ Plan Network A & B, and UTP Plan Network C).
 * Handles regulatory halts, trade condition flags, and Price Band distributions.
 */
class SIPFeedHandler {
  private var _feedHandler : MarketDataFeedHandler
  private var _haltedSymbols : Map<String, Boolean>
  private var _lastSipSequence : Map<String, Long>
  private var _luldPriceBands : Map<String, LULDBand>

  public static class LULDBand {
    var _lowerPrice : long as readonly LowerPrice
    var _upperPrice : long as readonly UpperPrice
    var _timestamp : long as readonly Timestamp

    public construct(lower : long, upper : long, ts : long) {
      _lowerPrice = lower
      _upperPrice = upper
      _timestamp = ts
    }

    public property get LowerPriceDouble() : double {
      return (_lowerPrice as double) / 10000.0
    }

    public property get UpperPriceDouble() : double {
      return (_upperPrice as double) / 10000.0
    }

    override public function toString() : String {
      return "LULDBand[" + LowerPriceDouble + " - " + UpperPriceDouble + "]"
    }
  }

  public construct(feedHandler : MarketDataFeedHandler) {
    _feedHandler = feedHandler
    _haltedSymbols = new ConcurrentHashMap<String, Boolean>()
    _lastSipSequence = new ConcurrentHashMap<String, Long>()
    _luldPriceBands = new ConcurrentHashMap<String, LULDBand>()
  }

  /**
   * Processes a SIP CQS/UQDF top of book quotation message.
   */
  public function onConsolidatedQuote(symbol : String, venue : VenueId, bidPrice : long, bidSize : long,
                                      askPrice : long, askSize : long, seq : long, timestamp : long) {
    if (isHalted(symbol)) {
      return
    }

    var lastSeq = _lastSipSequence.get(symbol)
    if (lastSeq != null && seq <= lastSeq.longValue()) {
      return // Out of order SIP packet dropped
    }
    _lastSipSequence.put(symbol, Long.valueOf(seq))

    var q = new Quote(venue, symbol, bidPrice, bidSize, askPrice, askSize, timestamp, seq)
    _feedHandler.onQuotePacket(q)
  }

  /**
   * Sets or clears a regulatory trading halt (e.g. SEC Rule 12d2-2 or LULD pause).
   */
  public function setRegulatoryHalt(symbol : String, halted : boolean, reason : String) {
    _haltedSymbols.put(symbol, Boolean.valueOf(halted))
    if (halted) {
      // Clear books on feed handler for halted symbol
      var books = _feedHandler.Level2Books.get(symbol)
      if (books != null) {
        for (venue in books.keySet()) {
          books.get(venue).clear()
        }
      }
    }
  }

  /**
   * Checks whether trading in a symbol is currently halted.
   */
  public function isHalted(symbol : String) : boolean {
    var h = _haltedSymbols.get(symbol)
    return h != null && h.booleanValue()
  }

  /**
   * Updates Limit-Up/Limit-Down (LULD) price bands received over the SIP feed.
   */
  public function onLULDBandsUpdate(symbol : String, lowerBand : long, upperBand : long, timestamp : long) {
    _luldPriceBands.put(symbol, new LULDBand(lowerBand, upperBand, timestamp))
  }

  /**
   * Gets current LULD Price Band for a symbol.
   */
  public function getLULDBand(symbol : String) : LULDBand {
    return _luldPriceBands.get(symbol)
  }
}
