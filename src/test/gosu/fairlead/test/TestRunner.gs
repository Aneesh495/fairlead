package fairlead.test

/**
 * Master test runner executing the complete Fairlead Gosu test suite:
 * Unit, Integration, Invariant Fuzzing, and Regression Bug Reproduction suites.
 */
class TestRunner {
  public static function main(args : String[]) {
    print("================================================================================")
    print("                  FAIRLEAD TEST SUITE // FULL ENGINE VERIFICATION               ")
    print("================================================================================")
    var startNs = java.lang.System.nanoTime()

    var passed = 0
    var totalSuites = 6

    try {
      ModelUnitTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] ModelUnitTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      OrderBookUnitTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] OrderBookUnitTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      RiskGateUnitTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] RiskGateUnitTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      SyntheticNBBOTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] SyntheticNBBOTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      SORRoutingUnitTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] SORRoutingUnitTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      AlgoExecutionUnitTest.run()
      passed++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] AlgoExecutionUnitTest failed: " + e.getMessage())
      e.printStackTrace()
    }

    try {
      ProtocolAnalyticsUnitTest.run()
      passed++
      totalSuites++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] ProtocolAnalyticsUnitTest failed: " + e.getMessage())
      e.printStackTrace()
      totalSuites++
    }

    try {
      RegressionBugSuiteTest.run()
      passed++
      totalSuites++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] RegressionBugSuiteTest failed: " + e.getMessage())
      e.printStackTrace()
      totalSuites++
    }

    try {
      InvariantFuzzTest.run()
      passed++
      totalSuites++
    } catch (e : java.lang.Throwable) {
      print("  [FAIL] InvariantFuzzTest failed: " + e.getMessage())
      e.printStackTrace()
      totalSuites++
    }

    var elapsedMs = ((java.lang.System.nanoTime() - startNs) as double) / 1000000.0
    print("--------------------------------------------------------------------------------")
    print(" VERIFICATION SUMMARY: " + passed + "/" + totalSuites + " test suites PASSED in " +
          java.lang.String.format("%.2f", new Object[]{elapsedMs}) + " ms")
    print("================================================================================")

    if (passed < totalSuites) {
      java.lang.System.exit(1)
    }
  }
}
