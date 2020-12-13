package fairlead.analytics

uses fairlead.model.Side
uses fairlead.model.VenueId
uses java.util.Map
uses java.util.HashMap
uses java.util.List
uses java.util.ArrayList

/**
 * Post-trade markout analyzer measuring price drift at 1ms, 10ms, 100ms, 1s, and 5s intervals.
 * Diagnoses adverse selection, alpha decay, and toxic flow across execution venues.
 */
class MarkoutAnalyzer {
  public static final var HORIZONS : String[] = new String[]{"1ms", "10ms", "100ms", "1s", "5s"}

  static class MarkoutRecord {
    var _orderId : String as OrderId
    var _venue : VenueId as Venue
    var _side : Side as Side
    var _tradePrice : double as TradePrice
    var _markouts : Map<String, Double> as HorizonMarkouts // Horizon -> Markout in bps

    construct(id : String, v : VenueId, side : Side, px : double) {
      _orderId = id
      _venue = v
      _side = side
      _tradePrice = px
      _markouts = new HashMap<String, Double>()
    }

    public function recordHorizonMidpoint(horizon : String, midPx : double) {
      if (_tradePrice > 0.0 && midPx > 0.0) {
        var diff = _side.IsBuy ? (midPx - _tradePrice) : (_tradePrice - midPx)
        var bps = (diff / _tradePrice) * 10000.0
        _markouts.put(horizon, bps)
      }
    }
  }

  var _records : List<MarkoutRecord> as Records

  construct() {
    _records = new ArrayList<MarkoutRecord>()
  }

  public function createRecord(orderId : String, venue : VenueId, side : Side, tradePx : double) : MarkoutRecord {
    var rec = new MarkoutRecord(orderId, venue, side, tradePx)
    _records.add(rec)
    return rec
  }

  public function computeMeanMarkoutByHorizon() : Map<String, Double> {
    var sums = new HashMap<String, Double>()
    var counts = new HashMap<String, Integer>()

    for (h in HORIZONS) {
      sums.put(h, 0.0)
      counts.put(h, 0)
    }

    for (rec in _records) {
      for (entry in rec.HorizonMarkouts.entrySet()) {
        var h = entry.getKey()
        var val = entry.getValue()
        if (sums.containsKey(h)) {
          sums.put(h, sums.get(h) + val)
          counts.put(h, counts.get(h) + 1)
        }
      }
    }

    var means = new HashMap<String, Double>()
    for (h in HORIZONS) {
      var c = counts.get(h)
      means.put(h, c > 0 ? (sums.get(h) / (c as double)) : 0.0)
    }

    return means
  }

  public function clear() {
    _records.clear()
  }
}
