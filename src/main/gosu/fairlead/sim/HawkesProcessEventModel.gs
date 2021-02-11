package fairlead.sim

uses java.util.Random
uses java.util.List
uses java.util.ArrayList

/**
 * Univariate Hawkes Self-Exciting Point Process.
 * Models endogenous order flow clustering and high-frequency order arrivals.
 * Conditional intensity:
 *   lambda(t) = mu + sum_{t_i < t} alpha * exp(-beta * (t - t_i))
 * Implements Ogata's modified thinning simulation algorithm.
 */
class HawkesProcessEventModel {
  private var _mu : double      // Baseline intensity
  private var _alpha : double   // Excitation amplitude
  private var _beta : double    // Exponential decay rate
  private var _random : Random

  public construct() {
    this(1.2, 0.8, 1.5, 42L)
  }

  public construct(mu : double, alpha : double, beta : double, seed : long) {
    if (alpha >= beta) {
      throw new IllegalArgumentException("Subcriticality requirement violated: alpha must be strictly less than beta for stability")
    }
    _mu = mu
    _alpha = alpha
    _beta = beta
    _random = new Random(seed)
  }

  public property get BaselineIntensity() : double {
    return _mu
  }

  public property get BranchingRatio() : double {
    return _alpha / _beta
  }

  /**
   * Evaluates conditional intensity lambda(t) given history of past event timestamps.
   */
  public function intensityAt(t : double, history : List<Double>) : double {
    var sum = 0.0
    if (history != null) {
      for (ti in history) {
        if (ti.doubleValue() < t) {
          sum += _alpha * Math.exp(-_beta * (t - ti.doubleValue()))
        }
      }
    }
    return _mu + sum
  }

  /**
   * Simulates event arrival timestamps over duration [0, horizonSeconds] via Ogata thinning.
   */
  public function simulate(horizonSeconds : double) : List<Double> {
    var timestamps = new ArrayList<Double>()
    var t = 0.0
    var currentIntensity = _mu

    while (t < horizonSeconds) {
      // Upper bound intensity candidate
      var maxLambda = currentIntensity
      var u1 = _random.nextDouble()
      var dt = -Math.log(Math.max(1e-10, u1)) / maxLambda
      t += dt

      if (t >= horizonSeconds) {
        break
      }

      // Recompute exact intensity at proposed time t
      var exactLambda = intensityAt(t, timestamps)
      var u2 = _random.nextDouble()

      // Thinning rejection sampling
      if (u2 * maxLambda <= exactLambda) {
        timestamps.add(Double.valueOf(t))
        currentIntensity = exactLambda + _alpha
      } else {
        currentIntensity = exactLambda
      }
    }

    return timestamps
  }
}
