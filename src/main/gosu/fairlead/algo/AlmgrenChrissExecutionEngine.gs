package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.FillAllocation
uses fairlead.model.VenueId
uses java.util.List
uses java.util.ArrayList

/**
 * Almgren-Chriss (2000) Optimal Execution Engine.
 * Dynamically constructs the mathematically optimal trading trajectory minimizing expected
 * execution cost (temporary and permanent market impact) while penalizing portfolio variance (timing risk):
 *
 *   min E[x] + lambda * Var[x]
 *
 * Trajectory formula:
 *   x_j = X_0 * sinh(kappa * (T - t_j)) / sinh(kappa * T)
 *   where kappa = sqrt( (lambda * sigma^2) / eta )
 */
class AlmgrenChrissExecutionEngine implements IExecutionStrategy {
  var _preferredVenue : VenueId as PreferredVenue
  var _permanentImpactGamma : double as Gamma // Permanent price impact parameter
  var _temporaryImpactEta : double as Eta     // Temporary price impact parameter
  var _riskAversionLambda : double as Lambda // Trader risk aversion coefficient
  var _annualVolatilitySigma : double as Sigma // Asset price volatility

  construct(venue : VenueId, gamma : double, eta : double, lambda : double, sigma : double) {
    _preferredVenue = venue != null ? venue : VenueId.NASDAQ
    _permanentImpactGamma = gamma > 0.0 ? gamma : 2.5e-7
    _temporaryImpactEta = eta > 0.0 ? eta : 2.5e-6
    _riskAversionLambda = lambda >= 0.0 ? lambda : 1.0e-6
    _annualVolatilitySigma = sigma > 0.0 ? sigma : 0.30
  }

  override property get StrategyName() : String {
    return "ALGO_ALMGREN_CHRISS"
  }

  public function computeKappa() : double {
    if (_riskAversionLambda <= 0.0 || _temporaryImpactEta <= 0.0) {
      return 0.0
    }
    // Daily volatility variance: sigma_daily^2 = sigma_annual^2 / 252
    var sigmaDailySq = (_annualVolatilitySigma * _annualVolatilitySigma) / 252.0
    return java.lang.Math.sqrt((_riskAversionLambda * sigmaDailySq) / _temporaryImpactEta)
  }

  /**
   * Pre-calculates the complete theoretical inventory holding trajectory across all N steps.
   */
  public function generateOptimalTrajectory(totalShares : long, steps : int) : List<Long> {
    var trajectory = new ArrayList<Long>()
    if (totalShares <= 0L || steps <= 0) return trajectory

    var kappa = computeKappa()
    var T = steps as double

    if (kappa <= 1e-9) {
      // Risk-neutral linear trajectory (TWAP equivalent)
      for (j in 0..steps) {
        var remaining = java.lang.Math.round((totalShares as double) * (1.0 - ((j as double) / T)))
        trajectory.add(remaining)
      }
      return trajectory
    }

    var sinhKT = java.lang.Math.sinh(kappa * T)

    for (j in 0..steps) {
      var t_j = j as double
      var x_j = (totalShares as double) * (java.lang.Math.sinh(kappa * (T - t_j)) / sinhKT)
      trajectory.add(java.lang.Math.round(java.lang.Math.max(0.0, x_j)))
    }

    return trajectory
  }

  override function computeNextSlice(parentOrder : Order, progress : ExecutionProgress, nbbo : NBBO) : FillAllocation {
    if (parentOrder == null || progress == null || progress.IsCompleted) {
      return null
    }

    var steps = progress.TotalIntervals
    var trajectory = generateOptimalTrajectory(parentOrder.Quantity, steps)

    var currentStep = progress.IntervalsCompleted
    var targetRemainingAtNextStep = currentStep + 1 < trajectory.size() ? trajectory.get(currentStep + 1) : 0L

    var targetCurrentRemaining = trajectory.get(currentStep)
    var plannedSlice = targetCurrentRemaining - targetRemainingAtNextStep

    if (currentStep + 1 >= steps) {
      plannedSlice = progress.RemainingQuantity
    }

    var sliceQty = java.lang.Math.max(10L, java.lang.Math.min(progress.RemainingQuantity, plannedSlice))

    // Determine target execution limit price
    var targetPx = parentOrder.LimitPrice
    if (nbbo != null && nbbo.IsValid) {
      if (parentOrder.Side.IsBuy) {
        targetPx = java.lang.Math.min(parentOrder.LimitPrice, nbbo.BestAskPrice)
      } else {
        targetPx = java.lang.Math.max(parentOrder.LimitPrice, nbbo.BestBidPrice)
      }
    }

    return new FillAllocation(_preferredVenue, sliceQty, targetPx, 0.0, StrategyName, currentStep + 1, _preferredVenue.BaseLatencyMicros)
  }

  override function isScheduleComplete(progress : ExecutionProgress) : boolean {
    return progress != null && progress.IsCompleted
  }
}
