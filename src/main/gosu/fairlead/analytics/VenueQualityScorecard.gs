package fairlead.analytics

uses fairlead.model.VenueId
uses java.util.Map
uses java.util.HashMap

/**
 * Multi-venue execution quality scorecard tracking fill rates, round-trip turnaround latency,
 * rejection ratios, and fee/rebate economic attribution across routing destinations.
 */
class VenueQualityScorecard {
  static class VenueStats {
    var _venue : VenueId as Venue
    var _routedOrders : long as RoutedOrders
    var _filledOrders : long as FilledOrders
    var _rejectedOrders : long as RejectedOrders
    var _totalExecutedShares : long as TotalExecutedShares
    var _totalTurnaroundLatencyMicros : long as TotalTurnaroundLatencyMicros
    var _totalNetFeesDollars : double as TotalNetFeesDollars

    construct(v : VenueId) {
      _venue = v
      _routedOrders = 0L
      _filledOrders = 0L
      _rejectedOrders = 0L
      _totalExecutedShares = 0L
      _totalTurnaroundLatencyMicros = 0L
      _totalNetFeesDollars = 0.0
    }

    public function recordRoute() {
      _routedOrders++
    }

    public function recordFill(shares : long, latencyMicros : long, feeOrRebate : double) {
      _filledOrders++
      _totalExecutedShares += shares
      _totalTurnaroundLatencyMicros += latencyMicros
      _totalNetFeesDollars += feeOrRebate
    }

    public function recordReject() {
      _rejectedOrders++
    }

    public property get FillRatePercentage() : double {
      return _routedOrders > 0L ? (((_filledOrders as double) / (_routedOrders as double)) * 100.0) : 0.0
    }

    public property get AverageTurnaroundMicros() : double {
      return _filledOrders > 0L ? ((_totalTurnaroundLatencyMicros as double) / (_filledOrders as double)) : 0.0
    }
  }

  var _statsMap : Map<VenueId, VenueStats> as Stats

  construct() {
    _statsMap = new HashMap<VenueId, VenueStats>()
    for (v in VenueId.values()) {
      _statsMap.put(v, new VenueStats(v))
    }
  }

  public function getStats(v : VenueId) : VenueStats {
    return _statsMap.get(v)
  }

  public function recordRouting(v : VenueId) {
    var s = _statsMap.get(v)
    if (s != null) s.recordRoute()
  }

  public function recordFill(v : VenueId, shares : long, latencyMicros : long, fee : double) {
    var s = _statsMap.get(v)
    if (s != null) s.recordFill(shares, latencyMicros, fee)
  }

  public function recordReject(v : VenueId) {
    var s = _statsMap.get(v)
    if (s != null) s.recordReject()
  }
}
