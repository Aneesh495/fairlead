package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses java.util.List
uses java.util.ArrayList

/**
 * Co-integrated Pairs Trading Algorithmic Execution Strategy.
 * Computes real-time cointegration spread Z-scores across two correlated assets:
 *   Spread = Price_A - (HedgeRatio * Price_B)
 *   Z = (Spread - Mean) / StdDev
 * Triggers simultaneous execution across both legs to eliminate unhedged leg risk.
 */
class PairTradingStrategy {
  private var _symbolA : String
  private var _symbolB : String
  private var _hedgeRatio : double
  private var _spreadMean : double
  private var _spreadStdDev : double
  private var _entryZScore : double
  private var _exitZScore : double
  private var _inPosition : boolean
  private var _currentPositionSide : String

  public static class PairSignal {
    var _symbolA : String as readonly SymbolA
    var _symbolB : String as readonly SymbolB
    var _spread : double as readonly Spread
    var _zScore : double as readonly ZScore
    var _actionA : Side as readonly ActionA
    var _actionB : Side as readonly ActionB
    var _signalName : String as readonly SignalName

    public construct(symA : String, symB : String, spread : double, z : double,
                     actA : Side, actB : Side, name : String) {
      _symbolA = symA
      _symbolB = symB
      _spread = spread
      _zScore = z
      _actionA = actA
      _actionB = actB
      _signalName = name
    }

    override public function toString() : String {
      return "PairSignal[" + SignalName + " Z=" + String.format("%.2f", new Object[]{ZScore}) +
             " ActA=" + ActionA + " ActB=" + ActionB + "]"
    }
  }

  public construct(symbolA : String, symbolB : String, hedgeRatio : double,
                   spreadMean : double, spreadStdDev : double,
                   entryZScore : double, exitZScore : double) {
    _symbolA = symbolA
    _symbolB = symbolB
    _hedgeRatio = hedgeRatio
    _spreadMean = spreadMean
    _spreadStdDev = spreadStdDev
    _entryZScore = entryZScore
    _exitZScore = exitZScore
    _inPosition = false
    _currentPositionSide = "FLAT"
  }

  public property get InPosition() : boolean {
    return _inPosition
  }

  public property get CurrentPositionSide() : String {
    return _currentPositionSide
  }

  /**
   * Evaluates the pair quotation state and generates execution signals.
   */
  public function evaluate(nbboA : NBBO, nbboB : NBBO) : PairSignal {
    if (nbboA == null || !nbboA.IsValid || nbboB == null || !nbboB.IsValid) {
      return null
    }

    var midA = (nbboA.Midpoint as double) / 10000.0
    var midB = (nbboB.Midpoint as double) / 10000.0

    var currentSpread = midA - (_hedgeRatio * midB)
    var zScore = _spreadStdDev > 0.0 ? (currentSpread - _spreadMean) / _spreadStdDev : 0.0

    // Condition 1: Long spread entry (Asset A underpriced vs Asset B)
    if (!_inPosition && zScore <= -_entryZScore) {
      _inPosition = true
      _currentPositionSide = "LONG_SPREAD"
      return new PairSignal(_symbolA, _symbolB, currentSpread, zScore, Side.BUY, Side.SELL_SHORT, "ENTER_LONG_SPREAD")
    }

    // Condition 2: Short spread entry (Asset A overpriced vs Asset B)
    if (!_inPosition && zScore >= _entryZScore) {
      _inPosition = true
      _currentPositionSide = "SHORT_SPREAD"
      return new PairSignal(_symbolA, _symbolB, currentSpread, zScore, Side.SELL_SHORT, Side.BUY, "ENTER_SHORT_SPREAD")
    }

    // Condition 3: Mean reversion exit
    if (_inPosition && Math.abs(zScore) <= _exitZScore) {
      var closeActA = _currentPositionSide == "LONG_SPREAD" ? Side.SELL : Side.BUY
      var closeActB = _currentPositionSide == "LONG_SPREAD" ? Side.BUY : Side.SELL
      _inPosition = false
      _currentPositionSide = "FLAT"
      return new PairSignal(_symbolA, _symbolB, currentSpread, zScore, closeActA, closeActB, "EXIT_SPREAD_REVERSION")
    }

    return new PairSignal(_symbolA, _symbolB, currentSpread, zScore, null, null, "HOLD_NEUTRAL")
  }
}
