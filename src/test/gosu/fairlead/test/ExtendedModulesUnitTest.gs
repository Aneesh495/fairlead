package fairlead.test

uses fairlead.marketdata.feed.SIPFeedHandler
uses fairlead.marketdata.feed.BZXDepthFeedHandler
uses fairlead.marketdata.MarketDataFeedHandler
uses fairlead.risk.ShortSaleCircuitBreakerFilter
uses fairlead.risk.LimitUpLimitDownFilter
uses fairlead.risk.RiskGate
uses fairlead.sor.AdaptiveRoutingEngine
uses fairlead.algo.SniperStrategy
uses fairlead.algo.PairTradingStrategy
uses fairlead.analytics.OrderFlowToxicityAnalyzer
uses fairlead.sim.HawkesProcessEventModel
uses fairlead.sim.MarketMicrostructureSimulator
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.VenueId
uses fairlead.model.NBBO

/**
 * Unit and integration tests for extended market data feeds, LULD/Rule 201 risk filters,
 * adaptive bandit routing, sniper execution, pair trading, and VPIN toxicity analytics.
 */
class ExtendedModulesUnitTest {
  public static function runAll() {
    print("  -> Running ExtendedModulesUnitTest...")
    testSIPFeedAndRegulatoryHalt()
    testBZXDepthFeed()
    testShortSaleCircuitBreakerFilter()
    testLULDPriceBandFilter()
    testAdaptiveBanditRouter()
    testSniperStrategy()
    testPairTradingStrategy()
    testVPINToxicityAnalyzer()
    testHawkesProcessAndSimulator()
    print("     [PASS] ExtendedModulesUnitTest completed successfully.")
  }

  public static function testSIPFeedAndRegulatoryHalt() {
    var handler = new MarketDataFeedHandler()
    var sip = new SIPFeedHandler(handler)

    sip.onConsolidatedQuote("MSFT", VenueId.NASDAQ, 4000000L, 500L, 4000500L, 600L, 1L, 1000L)
    var nbbo = handler.getNBBO("MSFT")
    if (nbbo == null || !nbbo.IsValid) {
      throw new IllegalStateException("Expected valid NBBO after SIP quote")
    }

    // Set regulatory halt
    sip.setRegulatoryHalt("MSFT", true, "LULD_PAUSE")
    if (!sip.isHalted("MSFT")) {
      throw new IllegalStateException("Symbol should be marked halted")
    }

    // Subsequent quotes should be ignored while halted
    sip.onConsolidatedQuote("MSFT", VenueId.NASDAQ, 4010000L, 1000L, 4010500L, 1000L, 2L, 2000L)
    var book = handler.Level2Books.get("MSFT").get(VenueId.NASDAQ)
    if (book.BestBidPrice != 0L) {
      throw new IllegalStateException("Book should be cleared upon regulatory halt")
    }
  }

  public static function testBZXDepthFeed() {
    var bzx = new BZXDepthFeedHandler()
    bzx.onAddOrder("NVDA", 101L, Side.BUY, 200L, PriceLevel.fromDouble(120.50), 1000L)
    bzx.onAddOrder("NVDA", 102L, Side.BUY, 300L, PriceLevel.fromDouble(120.50), 1001L)

    var book = bzx.getBook("NVDA")
    if (book.BestBidPrice != PriceLevel.fromDouble(120.50)) {
      throw new IllegalStateException("Expected BZX best bid at 120.50")
    }
    if (book.BestBidSize != 500L) {
      throw new IllegalStateException("Expected total bid depth 500 shares")
    }

    // Partial execute
    bzx.onOrderExecuted("NVDA", 101L, 100L, 9999L)
    if (book.BestBidSize != 400L) {
      throw new IllegalStateException("Expected remaining bid depth 400 shares")
    }

    // Delete second order
    bzx.onOrderDelete("NVDA", 102L)
    if (book.BestBidSize != 100L) {
      throw new IllegalStateException("Expected remaining bid depth 100 shares")
    }
  }

  public static function testShortSaleCircuitBreakerFilter() {
    var filter = new ShortSaleCircuitBreakerFilter()
    filter.setCircuitBreaker("TSLA", true)

    var nbbo = new NBBO("TSLA", 2500000L, 500L, 2500500L, 500L, 1000L, 1L) // Bid 250.00, Ask 250.05

    // Short sale at 249.99 (below bid) -> Must Fail
    var badShort = new Order("O-SS-1", "ACC", "TSLA", Side.SELL_SHORT, OrderType.LIMIT,
                             TimeInForce.DAY, PriceLevel.fromDouble(249.99), 100L, "ACC", "T1", "STRAT")
    var res1 = filter.evaluate(badShort, nbbo)
    if (res1.Passed) {
      throw new IllegalStateException("Rule 201 should reject short sale below National Best Bid")
    }

    // Short sale at 250.00 (at bid) -> Must Fail
    var atBidShort = new Order("O-SS-2", "ACC", "TSLA", Side.SELL_SHORT, OrderType.LIMIT,
                               TimeInForce.DAY, PriceLevel.fromDouble(250.00), 100L, "ACC", "T1", "STRAT")
    var res2 = filter.evaluate(atBidShort, nbbo)
    if (res2.Passed) {
      throw new IllegalStateException("Rule 201 should reject short sale at National Best Bid")
    }

    // Short sale at 250.01 (above bid) -> Must Pass
    var goodShort = new Order("O-SS-3", "ACC", "TSLA", Side.SELL_SHORT, OrderType.LIMIT,
                              TimeInForce.DAY, PriceLevel.fromDouble(250.01), 100L, "ACC", "T1", "STRAT")
    var res3 = filter.evaluate(goodShort, nbbo)
    if (!res3.Passed) {
      throw new IllegalStateException("Rule 201 should permit short sale strictly above National Best Bid")
    }
  }

  public static function testLULDPriceBandFilter() {
    var luld = new LimitUpLimitDownFilter()
    luld.setBands("GOOG", PriceLevel.fromDouble(170.00), PriceLevel.fromDouble(190.00))

    var nbbo = new NBBO("GOOG", 1800000L, 100L, 1800500L, 100L, 1000L, 1L)

    // Buy order at 195.00 exceeds upper band 190.00 -> Must Fail
    var aggBuy = new Order("O-LULD-1", "ACC", "GOOG", Side.BUY, OrderType.LIMIT,
                           TimeInForce.DAY, PriceLevel.fromDouble(195.00), 100L, "ACC", "T1", "STRAT")
    var res1 = luld.evaluate(aggBuy, nbbo)
    if (res1.Passed) {
      throw new IllegalStateException("LULD should reject buy order above upper band")
    }

    // Sell order at 165.00 below lower band 170.00 -> Must Fail
    var aggSell = new Order("O-LULD-2", "ACC", "GOOG", Side.SELL, OrderType.LIMIT,
                            TimeInForce.DAY, PriceLevel.fromDouble(165.00), 100L, "ACC", "T1", "STRAT")
    var res2 = luld.evaluate(aggSell, nbbo)
    if (res2.Passed) {
      throw new IllegalStateException("LULD should reject sell order below lower band")
    }

    // Valid order within bands
    var validBuy = new Order("O-LULD-3", "ACC", "GOOG", Side.BUY, OrderType.LIMIT,
                             TimeInForce.DAY, PriceLevel.fromDouble(180.05), 100L, "ACC", "T1", "STRAT")
    var res3 = luld.evaluate(validBuy, nbbo)
    if (!res3.Passed) {
      throw new IllegalStateException("LULD should pass orders within valid price bands")
    }
  }

  public static function testAdaptiveBanditRouter() {
    var router = new AdaptiveRoutingEngine(0.0, 1337L)
    router.recordExecutionFeedback(VenueId.NASDAQ, true)
    router.recordExecutionFeedback(VenueId.NASDAQ, true)
    router.recordExecutionFeedback(VenueId.BATS, false)

    var handler = new MarketDataFeedHandler()
    var replay = new fairlead.marketdata.MarketDataReplayEngine(handler, 999L)
    replay.generateLiquidMarket("AMD", 150.00)

    var nbbo = handler.getNBBO("AMD")
    var books = handler.Level2Books.get("AMD")

    var order = new Order("O-BANDIT-1", "ACC", "AMD", Side.BUY, OrderType.LIMIT,
                          TimeInForce.DAY, PriceLevel.fromDouble(150.02), 500L, "ACC", "T1", "BANDIT")
    var decision = router.route(order, nbbo, books)
    if (decision.TotalAllocatedQuantity <= 0) {
      throw new IllegalStateException("Adaptive bandit router should allocate shares")
    }
  }

  public static function testSniperStrategy() {
    var sniper = new SniperStrategy(PriceLevel.fromDouble(100.01), 100L, 500L)
    var handler = new MarketDataFeedHandler()
    var replay = new fairlead.marketdata.MarketDataReplayEngine(handler, 777L)
    replay.generateLiquidMarket("INTC", 100.00)

    var nbbo = handler.getNBBO("INTC")
    var books = handler.Level2Books.get("INTC")

    var order = new Order("O-SNIPER-1", "ACC", "INTC", Side.BUY, OrderType.LIMIT,
                          TimeInForce.IOC, PriceLevel.fromDouble(100.05), 400L, "ACC", "T1", "SNIPER")

    var dec = sniper.sweepVenues(order, nbbo, books)
    if (dec.TotalAllocatedQuantity <= 0) {
      throw new IllegalStateException("Sniper should fire when ask price matches limit")
    }
    if (sniper.BurstCount != 1) {
      throw new IllegalStateException("Sniper burst count should be incremented to 1")
    }
  }

  public static function testPairTradingStrategy() {
    // Mean = 5.0, StdDev = 1.0, Entry = 2.0, Exit = 0.5
    var pair = new PairTradingStrategy("PEP", "KO", 1.0, 5.0, 1.0, 2.0, 0.5)

    // Spread = 175.00 - 167.00 = 8.0 -> Z = (8 - 5) / 1 = +3.0 (Overpriced A -> Short A, Buy B)
    var nbboA = new NBBO("PEP", PriceLevel.fromDouble(174.99), 100L, PriceLevel.fromDouble(175.01), 100L, 1000L, 1L)
    var nbboB = new NBBO("KO", PriceLevel.fromDouble(166.99), 100L, PriceLevel.fromDouble(167.01), 100L, 1000L, 1L)

    var sig = pair.evaluate(nbboA, nbboB)
    if (sig == null || sig.SignalName != "ENTER_SHORT_SPREAD") {
      throw new IllegalStateException("Expected ENTER_SHORT_SPREAD signal, got: " + sig)
    }
    if (!pair.InPosition) {
      throw new IllegalStateException("Pair strategy should be in position")
    }

    // Mean reverts: Spread = 171.00 - 166.00 = 5.0 -> Z = 0.0 -> Exit
    var nbboA2 = new NBBO("PEP", PriceLevel.fromDouble(170.99), 100L, PriceLevel.fromDouble(171.01), 100L, 2000L, 2L)
    var nbboB2 = new NBBO("KO", PriceLevel.fromDouble(165.99), 100L, PriceLevel.fromDouble(166.01), 100L, 2000L, 2L)

    var sigExit = pair.evaluate(nbboA2, nbboB2)
    if (sigExit == null || sigExit.SignalName != "EXIT_SPREAD_REVERSION") {
      throw new IllegalStateException("Expected EXIT_SPREAD_REVERSION signal, got: " + sigExit)
    }
    if (pair.InPosition) {
      throw new IllegalStateException("Pair strategy should be flat after exit")
    }
  }

  public static function testVPINToxicityAnalyzer() {
    var vpin = new OrderFlowToxicityAnalyzer(1000L, 10)
    // Ingest 10 buckets of heavily one-sided buy flow
    for (i in 0..|10) {
      vpin.onTrade(100.0 + (i as double) * 0.1, 1000L, Side.BUY)
    }

    if (vpin.CurrentVPIN < 0.90) {
      throw new IllegalStateException("VPIN for one-sided buy flow should be near 1.0, got: " + vpin.CurrentVPIN)
    }
    if (!vpin.isToxic(0.70)) {
      throw new IllegalStateException("Flow should be flagged as toxic")
    }
  }

  public static function testHawkesProcessAndSimulator() {
    var hawkes = new HawkesProcessEventModel(1.5, 0.9, 1.8, 12345L)
    var events = hawkes.simulate(5.0) // 5 seconds
    if (events.isEmpty()) {
      throw new IllegalStateException("Hawkes simulation should generate events")
    }

    var handler = new MarketDataFeedHandler()
    var sim = new MarketMicrostructureSimulator(handler, 54321L)
    sim.simulateTradingSession("SPY", 500.0, 50)
    var nbbo = handler.getNBBO("SPY")
    if (nbbo == null || !nbbo.IsValid) {
      throw new IllegalStateException("Microstructure simulator should produce valid NBBO")
    }
  }
}
