package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses fairlead.model.FillAllocation
uses fairlead.model.Side
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map
uses java.util.HashMap
uses java.util.List
uses java.util.ArrayList
uses java.util.Random
uses java.util.Collections
uses java.util.Comparator

/**
 * Adaptive Multi-Armed Bandit Smart Order Router.
 * Uses Bayesian Beta-Bernoulli Thompson Sampling to learn venue fill rates and
 * adverse selection in real-time. Dynamically steers order flow toward venues
 * with the highest empirical execution probabilities and lowest queue decay.
 */
class AdaptiveRoutingEngine implements ISmartOrderRouter {
  private var _alphaPriors : Map<VenueId, Double>
  private var _betaPriors : Map<VenueId, Double>
  private var _random : Random
  private var _explorationRate : double

  public static class VenueScore {
    var _venue : VenueId as readonly Venue
    var _sampledScore : double as readonly SampledScore

    public construct(v : VenueId, score : double) {
      _venue = v
      _sampledScore = score
    }
  }

  public construct() {
    this(0.10, 42L)
  }

  public construct(explorationRate : double, seed : long) {
    _explorationRate = explorationRate
    _random = new Random(seed)
    _alphaPriors = new HashMap<VenueId, Double>()
    _betaPriors = new HashMap<VenueId, Double>()

    for (v in VenueId.values()) {
      // Prior uniform Beta(1, 1) or mildly optimistic Beta(2, 2)
      _alphaPriors.put(v, Double.valueOf(2.0))
      _betaPriors.put(v, Double.valueOf(2.0))
    }
  }

  override public property get StrategyName() : String {
    return "ADAPTIVE_BANDIT_ROUTER"
  }

  /**
   * Updates Bayesian posterior parameters based on post-trade feedback.
   * A full fill without adverse markout increments alpha;
   * A rejection or severe adverse fill increments beta.
   */
  public function recordExecutionFeedback(venue : VenueId, success : boolean) {
    var a = _alphaPriors.get(venue).doubleValue()
    var b = _betaPriors.get(venue).doubleValue()

    if (success) {
      _alphaPriors.put(venue, Double.valueOf(a + 1.0))
    } else {
      _betaPriors.put(venue, Double.valueOf(b + 1.0))
    }
  }

  /**
   * Samples from approximate Beta distribution via Kumaraswamy approximation
   * or Gamma sampling for Thompson selection.
   */
  private function sampleScore(venue : VenueId) : double {
    var a = _alphaPriors.get(venue).doubleValue()
    var b = _betaPriors.get(venue).doubleValue()

    // Epsilon exploration
    if (_random.nextDouble() < _explorationRate) {
      return _random.nextDouble()
    }

    // Expected value + stochastic Thompson perturbation
    var mean = a / (a + b)
    var variance = (a * b) / ((a + b) * (a + b) * (a + b + 1.0))
    var stdDev = Math.sqrt(variance)
    var sample = mean + (_random.nextGaussian() * stdDev)
    return Math.max(0.0, Math.min(1.0, sample))
  }

  override public function route(order : Order, nbbo : NBBO, venueBooks : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var dec = new RoutingDecision(order, StrategyName, "Thompson bandit allocation")
    if (order == null || order.LeavesQuantity <= 0 || nbbo == null || !nbbo.IsValid) {
      return dec
    }

    var remaining = order.LeavesQuantity
    var isBuy = order.Side == Side.BUY
    var targetLimitPrice = order.LimitPrice

    // Rank venues according to sampled Thompson scores
    var rankedVenues = new ArrayList<VenueScore>()
    for (v in venueBooks.keySet()) {
      var score = sampleScore(v)
      rankedVenues.add(new VenueScore(v, score))
    }

    // Sort descending by sampled bandit score
    Collections.sort(rankedVenues, new Comparator<VenueScore>() {
      override public function compare(o1 : VenueScore, o2 : VenueScore) : int {
        return Double.compare(o2.SampledScore, o1.SampledScore)
      }
    })

    var prio = 1

    for (vs in rankedVenues) {
      if (remaining <= 0) break

      var venue = vs.Venue
      var book = venueBooks.get(venue)
      if (book == null) continue

      var availableQty = book.getAvailableVolumeUpTo(order.Side, targetLimitPrice)
      if (availableQty <= 0) continue

      var slice = Math.min(remaining, availableQty)
      var execPrice = isBuy ? book.BestAskPrice : book.BestBidPrice
      if (execPrice <= 0) {
        execPrice = targetLimitPrice
      }

      var alloc = new FillAllocation(venue, slice, execPrice, prio, StrategyName + "_PRIOR_" + String.format("%.2f", new Object[]{vs.SampledScore}))
      dec.addAllocation(alloc)

      remaining -= slice
      prio++
    }

    return dec
  }
}
