package fairlead.marketdata

uses fairlead.model.VenueId
uses fairlead.model.Quote
uses fairlead.model.NBBO
uses java.util.Map
uses java.util.HashMap
uses java.util.List
uses java.util.ArrayList

/**
 * Synthetic National Best Bid and Offer (NBBO) engine aggregating real-time quotes
 * across all active lit Reg NMS market centers, resolving multi-venue ties, and
 * detecting locked and crossed market states.
 */
class SyntheticNBBOEngine {
  var _symbol : String as Symbol
  var _venueQuotes : Map<VenueId, Quote> as VenueQuotes
  var _currentNBBO : NBBO as CurrentNBBO
  var _sequenceNumber : long as SequenceNumber
  var _lockedMarketCount : long as LockedMarketCount
  var _crossedMarketCount : long as CrossedMarketCount

  construct(symbol : String) {
    _symbol = symbol
    _venueQuotes = new HashMap<VenueId, Quote>()
    _currentNBBO = null
    _sequenceNumber = 0L
    _lockedMarketCount = 0L
    _crossedMarketCount = 0L
  }

  /**
   * Processes an incoming venue quote update and recomputes the consolidated synthetic NBBO.
   */
  public function onQuote(quote : Quote) : NBBO {
    if (quote == null || quote.Symbol != _symbol) return _currentNBBO

    // Only lit automated venues contribute to the protected NBBO under Reg NMS Rule 611
    if (!quote.Venue.IsProtectedQuoteVenue) {
      return _currentNBBO
    }

    _venueQuotes.put(quote.Venue, quote)
    _sequenceNumber++

    return recomputeNBBO()
  }

  public function recomputeNBBO() : NBBO {
    var maxBid = 0L
    var minAsk = java.lang.Long.MAX_VALUE

    // First pass: locate the best bid and best ask prices across all lit venues
    for (q in _venueQuotes.values()) {
      if (q.BidPrice > 0L && q.BidSize > 0L) {
        if (q.BidPrice > maxBid) {
          maxBid = q.BidPrice
        }
      }
      if (q.AskPrice > 0L && q.AskSize > 0L) {
        if (q.AskPrice < minAsk) {
          minAsk = q.AskPrice
        }
      }
    }

    if (maxBid == 0L || minAsk == java.lang.Long.MAX_VALUE) {
      return null
    }

    // Second pass: accumulate aggregate sizes and participant venues at best prices
    var totalBidSize = 0L
    var bidVenues = new ArrayList<VenueId>()
    var totalAskSize = 0L
    var askVenues = new ArrayList<VenueId>()

    for (q in _venueQuotes.values()) {
      if (q.BidPrice == maxBid && q.BidSize > 0L) {
        totalBidSize += q.BidSize
        bidVenues.add(q.Venue)
      }
      if (q.AskPrice == minAsk && q.AskSize > 0L) {
        totalAskSize += q.AskSize
        askVenues.add(q.Venue)
      }
    }

    var timeNs = java.lang.System.nanoTime()
    var nbbo = new NBBO(_symbol, maxBid, totalBidSize, bidVenues, minAsk, totalAskSize, askVenues, timeNs, _sequenceNumber)

    if (nbbo.IsLocked) {
      _lockedMarketCount++
    } else if (nbbo.IsCrossed) {
      _crossedMarketCount++
    }

    _currentNBBO = nbbo
    return nbbo
  }

  public function clearVenue(venue : VenueId) : NBBO {
    _venueQuotes.remove(venue)
    return recomputeNBBO()
  }

  public function clear() {
    _venueQuotes.clear()
    _currentNBBO = null
    _sequenceNumber = 0L
    _lockedMarketCount = 0L
    _crossedMarketCount = 0L
  }
}
