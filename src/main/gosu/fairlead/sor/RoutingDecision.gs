package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.FillAllocation
uses java.util.List
uses java.util.ArrayList

/**
 * Encapsulates a multi-venue routing plan produced by the Smart Order Router,
 * including venue slice allocations, expected fill economics, and execution strategy attribution.
 */
class RoutingDecision {
  var _parentOrder : Order as ParentOrder
  var _allocations : List<FillAllocation> as Allocations
  var _strategyUsed : String as StrategyUsed
  var _reason : String as Reason
  var _decisionTimeNs : long as DecisionTimeNs

  construct(parent : Order, strategy : String, reason : String) {
    _parentOrder = parent
    _allocations = new ArrayList<FillAllocation>()
    _strategyUsed = strategy
    _reason = reason
    _decisionTimeNs = java.lang.System.nanoTime()
  }

  public function addAllocation(alloc : FillAllocation) {
    if (alloc != null) {
      _allocations.add(alloc)
    }
  }

  public property get TotalAllocatedQuantity() : long {
    var total = 0L
    for (a in _allocations) {
      total += a.SlicedQuantity
    }
    return total
  }

  public property get UnallocatedQuantity() : long {
    var parentQty = _parentOrder != null ? _parentOrder.LeavesQuantity : 0L
    return java.lang.Math.max(0L, parentQty - TotalAllocatedQuantity)
  }

  public property get EstimatedAveragePrice() : double {
    var totalNotional = 0.0
    var totalQty = TotalAllocatedQuantity
    if (totalQty == 0L) return 0.0

    for (a in _allocations) {
      var px = (a.TargetPrice as double) / 10000.0
      totalNotional += px * (a.SlicedQuantity as double)
    }
    return totalNotional / (totalQty as double)
  }

  public property get TotalExpectedFees() : double {
    var total = 0.0
    for (a in _allocations) {
      total += a.ExpectedFeeOrRebate
    }
    return total
  }

  override function toString() : String {
    return "RoutingDecision[" + _strategyUsed + ": slices=" + _allocations.size() +
           " allocated=" + TotalAllocatedQuantity + " unallocated=" + UnallocatedQuantity +
           " estAvgPx=" + java.lang.String.format("%.4f", new Object[]{EstimatedAveragePrice}) +
           " expFee=" + java.lang.String.format("%.2f", new Object[]{TotalExpectedFees}) + "]"
  }
}
