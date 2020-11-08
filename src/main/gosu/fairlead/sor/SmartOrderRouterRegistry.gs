package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.model.FeeSchedule
uses fairlead.marketdata.OrderBookLevel2
uses fairlead.risk.RiskGate
uses fairlead.risk.RiskCheckResult
uses java.util.Map
uses java.util.HashMap

/**
 * Dynamic registry and lifecycle coordinator for Smart Order Routing strategies.
 * Orchestrates pre-trade risk validation, cascading multi-venue execution, and
 * fallback route handling across lit exchanges and dark pools.
 */
class SmartOrderRouterRegistry {
  var _routers : Map<String, ISmartOrderRouter> as Routers
  var _riskGate : RiskGate as RiskGate
  var _feeSchedule : FeeSchedule as FeeSchedule
  var _defaultStrategy : String as DefaultStrategy
  var _totalOrdersRouted : long as TotalOrdersRouted

  construct(gate : RiskGate, feeSched : FeeSchedule) {
    _routers = new HashMap<String, ISmartOrderRouter>()
    _riskGate = gate != null ? gate : new RiskGate()
    _feeSchedule = feeSched != null ? feeSched : new FeeSchedule()
    _defaultStrategy = "DEPTH_OF_BOOK_SWEEP"
    _totalOrdersRouted = 0L

    registerDefaultStrategies()
  }

  private function registerDefaultStrategies() {
    registerRouter(new RegNMSProtectedQuoteRouter(_feeSchedule))
    registerRouter(new DepthOfBookSweepRouter(_feeSchedule))
    registerRouter(new CostAwareRouter(_feeSchedule))
    registerRouter(new DarkPoolProbingRouter(_feeSchedule, 500L))
  }

  public function registerRouter(router : ISmartOrderRouter) {
    if (router != null) {
      _routers.put(router.StrategyName, router)
    }
  }

  public function getRouter(name : String) : ISmartOrderRouter {
    return _routers.get(name)
  }

  /**
   * Primary entry point for routing an order through risk gating and SOR strategy execution.
   */
  public function routeOrder(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>, requestedStrategy : String) : RoutingDecision {
    if (order == null) {
      return new RoutingDecision(null, "NONE", "Order is null")
    }

    // 1. Mandatory Pre-Trade Risk Validation (SEC Rule 15c3-5)
    var riskResult = _riskGate.validate(order, nbbo)
    if (!riskResult.Passed) {
      var rejectDecision = new RoutingDecision(order, "RISK_GATE_REJECT", riskResult.Reason)
      return rejectDecision
    }

    // 2. Resolve Strategy
    var strategyName = requestedStrategy != null && _routers.containsKey(requestedStrategy) ? requestedStrategy : _defaultStrategy
    var router = _routers.get(strategyName)
    if (router == null) {
      router = _routers.get("DEPTH_OF_BOOK_SWEEP")
    }

    // 3. Execute Strategy
    _totalOrdersRouted++
    return router.route(order, nbbo, books)
  }

  /**
   * Cascading Dark-to-Lit Smart Route: Probes dark pools first; if unallocated remainder exists,
   * cascades remainder to cost-aware lit exchange sweep.
   */
  public function routeDarkCascadeLit(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision {
    var combinedDecision = new RoutingDecision(order, "DARK_CASCADE_LIT", "Dark probe cascaded to lit sweep")

    // Step 1: Probe dark pools
    var darkRouter = _routers.get("DARK_POOL_PROBE")
    if (darkRouter != null) {
      var darkResult = darkRouter.route(order, nbbo, books)
      for (alloc in darkResult.Allocations) {
        combinedDecision.addAllocation(alloc)
      }
    }

    // Step 2: Sweep remaining unallocated quantity across lit venues
    var unallocated = combinedDecision.UnallocatedQuantity
    if (unallocated > 0L) {
      var childSlice = order.createChildSlice(order.OrderId + "-LIT", order.ClOrdId + "-LIT", null, unallocated, order.LimitPrice)
      var litRouter = _routers.get("COST_AWARE_OPTIMIZER")
      if (litRouter == null) {
        litRouter = _routers.get("DEPTH_OF_BOOK_SWEEP")
      }
      var litResult = litRouter.route(childSlice, nbbo, books)
      for (alloc in litResult.Allocations) {
        combinedDecision.addAllocation(alloc)
      }
    }

    return combinedDecision
  }
}
