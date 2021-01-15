package fairlead.test

uses fairlead.algo.TWAPExecutionEngine
uses fairlead.algo.VWAPExecutionEngine
uses fairlead.algo.AlmgrenChrissExecutionEngine
uses fairlead.algo.IcebergExecutionEngine
uses fairlead.algo.PeggedOrderEngine
uses fairlead.algo.ExecutionProgress
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses fairlead.model.NBBO
uses java.util.Arrays

/**
 * Unit test suite verifying quantitative execution algorithms:
 * TWAP, VWAP, Almgren-Chriss optimal trajectories, Iceberg replenishment, and Pegged orders.
 */
class AlgoExecutionUnitTest {
  public static function run() : boolean {
    print("  -> Running AlgoExecutionUnitTest...")
    testTWAPExecution()
    testVWAPExecution()
    testAlmgrenChrissTrajectory()
    testIcebergReserveReplenishment()
    testPeggedOrderCalculations()
    return true
  }

  private static function testTWAPExecution() {
    var twap = new TWAPExecutionEngine(VenueId.BATS, 0.10, 42L)
    var parent = new Order("O1", "C1", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(180.00), 5000L, "A1", "T1", "TWAP")
    var prog = new ExecutionProgress(parent, 5, 180.00)

    for (i in 1..5) {
      var slice = twap.computeNextSlice(parent, prog, null)
      assert slice != null : "Slice must not be null"
      assert slice.SlicedQuantity > 0L : "Slice quantity must be positive"
      prog.recordSliceExecution(slice.SlicedQuantity, 180.00)
    }

    assert prog.IsCompleted : "TWAP schedule must be completed"
    assert prog.ExecutedQuantity == 5000L : "Executed quantity must equal full parent order (5000)"
  }

  private static function testVWAPExecution() {
    var vwap = new VWAPExecutionEngine(VenueId.NYSE, null, 0.15)
    var parent = new Order("O2", "C2", "SPY", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(500.00), 10000L, "A1", "T1", "VWAP")
    var prog = new ExecutionProgress(parent, 10, 500.00)

    for (i in 1..10) {
      var slice = vwap.computeNextSlice(parent, prog, null)
      prog.recordSliceExecution(slice.SlicedQuantity, 500.00)
    }

    assert prog.IsCompleted : "VWAP schedule must be completed"
    assert prog.ExecutedQuantity == 10000L : "VWAP must execute exactly 10,000 shares"
  }

  private static function testAlmgrenChrissTrajectory() {
    var ac = new AlmgrenChrissExecutionEngine(VenueId.NASDAQ, 2.5e-7, 2.5e-6, 5.0e-5, 0.40)
    var kappa = ac.computeKappa()
    assert kappa > 0.05 : "Kappa must be strictly positive"

    var traj = ac.generateOptimalTrajectory(10000L, 5)
    assert traj.size() == 6 : "Trajectory must contain N+1 points"
    assert traj.get(0) == 10000L : "Initial holdings must be 10,000"
    assert traj.get(5) == 0L : "Final holdings must be 0"

    // Verify monotonic decay of inventory
    for (i in 0..4) {
      assert traj.get(i) >= traj.get(i + 1) : "Inventory must strictly decrease monotonically"
    }
  }

  private static function testIcebergReserveReplenishment() {
    var iceberg = new IcebergExecutionEngine(VenueId.BATS, 500L, 0.20, 99L)
    var parent = new Order("O3", "C3", "MSFT", Side.BUY, OrderType.ICEBERG, TimeInForce.DAY, PriceLevel.fromDouble(400.00), 1500L, "A1", "T1", "ICEBERG")

    var reserve = 1500L
    var totalFilled = 0L

    while (reserve > 0L) {
      var peak = iceberg.computeNextPeak(parent, reserve, null)
      assert peak.SlicedQuantity > 0L : "Peak must be positive"
      totalFilled += peak.SlicedQuantity
      reserve -= peak.SlicedQuantity
    }

    assert totalFilled == 1500L : "Total iceberg filled must equal parent reserve (1500)"
  }

  private static function testPeggedOrderCalculations() {
    var peg = new PeggedOrderEngine(100L)
    var nbbo = new NBBO("GOOG", PriceLevel.fromDouble(175.00), 1000L, Arrays.asList({VenueId.NASDAQ}),
                        PriceLevel.fromDouble(175.10), 1000L, Arrays.asList({VenueId.NYSE}), System.nanoTime(), 1L)

    var midOrder = new Order("P1", "CP1", "GOOG", Side.BUY, OrderType.PEGGED_MIDPOINT, TimeInForce.DAY, PriceLevel.fromDouble(176.00), 500L, "A1", "T1", "PEG")
    var primOrder = new Order("P2", "CP2", "GOOG", Side.BUY, OrderType.PEGGED_PRIMARY, TimeInForce.DAY, PriceLevel.fromDouble(176.00), 500L, "A1", "T1", "PEG")

    var midPx = peg.calculatePeggedPrice(midOrder, nbbo, 0L)
    var primPx = peg.calculatePeggedPrice(primOrder, nbbo, 0L)

    assert midPx == 1750500L : "Midpoint peg must be 175.05"
    assert primPx == 1750000L : "Primary peg must be 175.00"
    assert peg.shouldReprice(1750000L, 1750500L) : "Delta 5 cents must trigger reprice"
    assert !peg.shouldReprice(1750000L, 1750050L) : "Delta half cent must not trigger reprice"
  }
}
