package fairlead.marketdata

uses fairlead.model.VenueId
uses fairlead.model.Side
uses fairlead.model.Quote
uses fairlead.model.NBBO
uses java.util.Map
uses java.util.HashMap

/**
 * Market data feed handler processing multi-exchange quote updates and L2 book events.
 * Manages per-venue sequence continuity, gap detection, packet reordering, and NBBO distribution.
 */
class MarketDataFeedHandler {
  var _nbboEngines : Map<String, SyntheticNBBOEngine> as NBBOEngines
  var _l2Books : Map<String, Map<VenueId, OrderBookLevel2>> as Level2Books
  var _expectedSeqMap : Map<VenueId, Long> as ExpectedSeqMap
  var _totalPacketsProcessed : long as TotalPacketsProcessed
  var _sequenceGapsDetected : long as SequenceGapsDetected

  construct() {
    _nbboEngines = new HashMap<String, SyntheticNBBOEngine>()
    _l2Books = new HashMap<String, Map<VenueId, OrderBookLevel2>>()
    _expectedSeqMap = new HashMap<VenueId, Long>()
    _totalPacketsProcessed = 0L
    _sequenceGapsDetected = 0L
  }

  public function getOrCreateNBBOEngine(symbol : String) : SyntheticNBBOEngine {
    var engine = _nbboEngines.get(symbol)
    if (engine == null) {
      engine = new SyntheticNBBOEngine(symbol)
      _nbboEngines.put(symbol, engine)
    }
    return engine
  }

  public function getOrCreateBook(venue : VenueId, symbol : String) : OrderBookLevel2 {
    var venueMap = _l2Books.get(symbol)
    if (venueMap == null) {
      venueMap = new HashMap<VenueId, OrderBookLevel2>()
      _l2Books.put(symbol, venueMap)
    }
    var book = venueMap.get(venue)
    if (book == null) {
      book = new OrderBookLevel2(venue, symbol)
      venueMap.put(venue, book)
    }
    return book
  }

  public function onQuotePacket(quote : Quote) : NBBO {
    if (quote == null) return null
    _totalPacketsProcessed++

    // Sequence continuity check per venue
    var expectedSeq = _expectedSeqMap.get(quote.Venue)
    if (expectedSeq != null && quote.SequenceNumber > expectedSeq) {
      _sequenceGapsDetected += (quote.SequenceNumber - expectedSeq)
    }
    _expectedSeqMap.put(quote.Venue, quote.SequenceNumber + 1L)

    // Update Level 2 book Top of Book
    var book = getOrCreateBook(quote.Venue, quote.Symbol)
    book.updateLevel(Side.BUY, quote.BidPrice, quote.BidSize, 1, quote.TimestampNs, quote.SequenceNumber)
    book.updateLevel(Side.SELL, quote.AskPrice, quote.AskSize, 1, quote.TimestampNs, quote.SequenceNumber)

    // Recompute synthetic NBBO
    var engine = getOrCreateNBBOEngine(quote.Symbol)
    return engine.onQuote(quote)
  }

  public function onDepthUpdate(venue : VenueId, symbol : String, side : Side,
                                price : long, quantity : long, orderCount : int,
                                timeNs : long, seq : long) : NBBO {
    _totalPacketsProcessed++
    var book = getOrCreateBook(venue, symbol)
    book.updateLevel(side, price, quantity, orderCount, timeNs, seq)

    // Synthesize quote if top of book changed
    var bestBid = book.BestBid
    var bestAsk = book.BestAsk
    var bidPx = bestBid != null ? bestBid.Price : 0L
    var bidSz = bestBid != null ? bestBid.TotalQuantity : 0L
    var askPx = bestAsk != null ? bestAsk.Price : 0L
    var askSz = bestAsk != null ? bestAsk.TotalQuantity : 0L

    var quote = new Quote(venue, symbol, bidPx, bidSz, askPx, askSz, timeNs, seq)
    var engine = getOrCreateNBBOEngine(symbol)
    return engine.onQuote(quote)
  }

  public function getNBBO(symbol : String) : NBBO {
    var engine = _nbboEngines.get(symbol)
    return engine != null ? engine.CurrentNBBO : null
  }
}
