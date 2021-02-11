package fairlead.analytics

uses java.util.LinkedList
uses java.util.Queue
uses fairlead.model.Side

/**
 * Volume-Synchronized Probability of Toxicity (VPIN) Analyzer.
 * Measures order flow toxicity and informed trader presence based on the
 * Easley, Lopez de Prado, and O'Hara (2012) market microstructure model.
 * Partitions continuous trade volume into constant-volume buckets to evaluate
 * order flow imbalance and impending adverse selection.
 */
class OrderFlowToxicityAnalyzer {
  private var _bucketVolume : long
  private var _windowSize : int
  private var _currentBuyVolume : long
  private var _currentSellVolume : long
  private var _currentBucketVolume : long
  private var _bucketImbalances : LinkedList<Double>
  private var _lastTradePrice : double
  private var _currentVPIN : double

  public construct() {
    this(5000L, 50) // Default: 5000 share buckets, 50 bucket window
  }

  public construct(bucketVolume : long, windowSize : int) {
    _bucketVolume = bucketVolume
    _windowSize = windowSize
    _currentBuyVolume = 0L
    _currentSellVolume = 0L
    _currentBucketVolume = 0L
    _bucketImbalances = new LinkedList<Double>()
    _lastTradePrice = 0.0
    _currentVPIN = 0.0
  }

  public property get CurrentVPIN() : double {
    return _currentVPIN
  }

  public property get BucketCount() : int {
    return _bucketImbalances.size()
  }

  /**
   * Records an executed trade.
   * Uses tick rule to classify buy vs sell volume if side is unknown.
   */
  public function onTrade(price : double, volume : long, side : Side) {
    if (volume <= 0) return

    var tradeSide = side
    if (tradeSide == null) {
      if (_lastTradePrice > 0.0) {
        tradeSide = price >= _lastTradePrice ? Side.BUY : Side.SELL
      } else {
        tradeSide = Side.BUY
      }
    }
    _lastTradePrice = price

    var remainingVolume = volume
    while (remainingVolume > 0) {
      var spaceInBucket = _bucketVolume - _currentBucketVolume
      var fillSlice = Math.min(remainingVolume, spaceInBucket)

      if (tradeSide == Side.BUY) {
        _currentBuyVolume += fillSlice
      } else {
        _currentSellVolume += fillSlice
      }
      _currentBucketVolume += fillSlice
      remainingVolume -= fillSlice

      // If bucket is full, close bucket and compute imbalance
      if (_currentBucketVolume >= _bucketVolume) {
        var imbalance = Math.abs((_currentBuyVolume - _currentSellVolume) as double)
        _bucketImbalances.addLast(Double.valueOf(imbalance))
        if (_bucketImbalances.size() > _windowSize) {
          _bucketImbalances.removeFirst()
        }

        recomputeVPIN()

        // Reset for next volume bucket
        _currentBucketVolume = 0L
        _currentBuyVolume = 0L
        _currentSellVolume = 0L
      }
    }
  }

  private function recomputeVPIN() {
    if (_bucketImbalances.isEmpty()) {
      _currentVPIN = 0.0
      return
    }

    var totalImbalance = 0.0
    for (imb in _bucketImbalances) {
      totalImbalance += imb.doubleValue()
    }

    var totalVolume = (_bucketImbalances.size() as double) * (_bucketVolume as double)
    _currentVPIN = totalVolume > 0.0 ? totalImbalance / totalVolume : 0.0
  }

  /**
   * Returns true if flow toxicity exceeds adverse selection threshold (e.g. 0.65).
   */
  public function isToxic(toxicityThreshold : double) : boolean {
    return _currentVPIN >= toxicityThreshold
  }
}
