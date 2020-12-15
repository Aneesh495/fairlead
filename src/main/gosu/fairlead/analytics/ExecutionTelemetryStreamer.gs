package fairlead.analytics

uses fairlead.model.Order
uses fairlead.model.ExecutionReport
uses java.util.List
uses java.util.ArrayList

/**
 * Real-time event and metric streaming aggregator broadcasting execution events,
 * latency snapshots, and throughput statistics to interactive dashboards and websocket clients.
 */
class ExecutionTelemetryStreamer {
  var _totalFillsStreamed : long as TotalFillsStreamed
  var _totalRoutedStreamed : long as TotalRoutedStreamed
  var _totalTradedVolume : long as TotalTradedVolume
  var _totalTradedNotional : double as TotalTradedNotional
  var _recentFills : List<ExecutionReport> as RecentFills

  construct() {
    _totalFillsStreamed = 0L
    _totalRoutedStreamed = 0L
    _totalTradedVolume = 0L
    _totalTradedNotional = 0.0
    _recentFills = new ArrayList<ExecutionReport>()
  }

  public function onExecution(report : ExecutionReport) {
    if (report == null) return
    _totalFillsStreamed++
    _totalTradedVolume += report.LastShares
    _totalTradedNotional += report.PrincipalTraded

    _recentFills.add(report)
    if (_recentFills.size() > 50) {
      _recentFills.remove(0)
    }
  }

  public function onOrderRouted(order : Order) {
    if (order == null) return
    _totalRoutedStreamed++
  }

  public function clear() {
    _totalFillsStreamed = 0L
    _totalRoutedStreamed = 0L
    _totalTradedVolume = 0L
    _totalTradedNotional = 0.0
    _recentFills.clear()
  }
}
