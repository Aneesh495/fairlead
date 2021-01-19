package fairlead.bench

/**
 * Benchmark runner entry point for execution performance profiling.
 */
class BenchRunner {
  public static function main(args : String[]) {
    print("================================================================================")
    print("                     FAIRLEAD MICROBENCHMARK SUITE                              ")
    print("================================================================================")

    var iterations = args.length > 0 ? java.lang.Integer.parseInt(args[0]) : 50000
    RouterThroughputBench.run(iterations)
    BookUpdateLatencyBench.run(iterations)

    print("================================================================================")
  }
}
