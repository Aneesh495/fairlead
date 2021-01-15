package fairlead.test

uses fairlead.protocol.FIXParser
uses fairlead.protocol.FIXBuilder
uses fairlead.protocol.FIXTag
uses fairlead.protocol.ITCH50Parser
uses fairlead.protocol.OUCH42Message
uses fairlead.protocol.BinaryProtocolCodec
uses fairlead.analytics.TransactionCostAnalyzer
uses fairlead.analytics.SpreadMetrics
uses fairlead.analytics.MarkoutAnalyzer
uses fairlead.model.Order
uses fairlead.model.Side
uses fairlead.model.OrderType
uses fairlead.model.TimeInForce
uses fairlead.model.PriceLevel
uses fairlead.model.ExecutionReport
uses fairlead.model.OrderStatus
uses fairlead.model.VenueId

/**
 * Unit test suite verifying wire protocol codecs (FIX, ITCH, OUCH, FRLD-1)
 * and transaction cost analytics (slippage, spread metrics, and markout curves).
 */
class ProtocolAnalyticsUnitTest {
  public static function run() : boolean {
    print("  -> Running ProtocolAnalyticsUnitTest...")
    testFIXParserAndChecksum()
    testITCH50BinaryCodec()
    testOUCH42BinaryCodec()
    testBinaryProtocolFraming()
    testTransactionCostAnalysis()
    testSpreadMetrics()
    testMarkoutAnalyzer()
    return true
  }

  private static function testFIXParserAndChecksum() {
    var raw = "8=FIX.4.4\u00019=55\u000135=D\u000149=CLNT\u000156=FAIR\u000111=C1\u000155=AAPL\u000154=1\u000138=500\u000144=150.00\u000110=123\u0001"
    var msg = FIXParser.parse(raw)
    assert msg != null : "FIX message parsed"
    assert msg.Symbol == "AAPL" : "Symbol must be AAPL"
    assert msg.getLong(FIXTag.OrderQty, 0L) == 500L : "OrderQty must be 500"

    var chk = FIXBuilder.computeChecksum("8=FIX.4.4\u00019=55\u000135=D\u0001")
    assert chk.length() == 3 : "Checksum must be 3 digits"
  }

  private static function testITCH50BinaryCodec() {
    var buf = ITCH50Parser.encodeAddOrder(9999L, true, 800, "MSFT", 4000000)
    var parsed = ITCH50Parser.parse(buf)
    assert parsed != null : "ITCH message must parse"
    assert parsed.MessageType == 'A' : "Must be 'A' message"
    assert parsed.Stock == "MSFT" : "Stock must be MSFT"
    assert parsed.Shares == 800L : "Shares must be 800"
    assert parsed.Price == 4000000L : "Price must be 400.00"
  }

  private static function testOUCH42BinaryCodec() {
    var buf = OUCH42Message.encodeEnterOrder(888L, false, 300, "NVDA", 1200000)
    var parsed = OUCH42Message.parse(buf)
    assert parsed != null : "OUCH message must parse"
    assert parsed.PacketType == 'O' : "Must be 'O' message"
    assert parsed.Stock == "NVDA" : "Stock must be NVDA"
    assert parsed.Side == Side.SELL : "Side must be SELL"
    assert parsed.Shares == 300L : "Shares must be 300"
  }

  private static function testBinaryProtocolFraming() {
    var payload = "FRLD_TEST_DATA".getBytes("UTF-8")
    var buf = BinaryProtocolCodec.encodeFrame(BinaryProtocolCodec.MSG_EXEC_REPORT, 42L, payload)
    var frame = BinaryProtocolCodec.decodeFrame(buf)

    assert frame != null : "Decoded frame must not be null"
    assert frame.MessageType == BinaryProtocolCodec.MSG_EXEC_REPORT : "Type must be MSG_EXEC_REPORT"
    assert frame.SequenceNumber == 42L : "Sequence must be 42"
    assert new java.lang.String(frame.Payload, "UTF-8") == "FRLD_TEST_DATA" : "Payload must match"
  }

  private static function testTransactionCostAnalysis() {
    var tca = new TransactionCostAnalyzer()
    var o = new Order("O1", "C1", "AAPL", Side.BUY, OrderType.LIMIT, TimeInForce.DAY, PriceLevel.fromDouble(150.00), 1000L, "A1", "T1", "TAG")
    o.recordFill(1000L, 150.03)

    var res = tca.analyzeOrder(o, 150.00, 150.02, 3.00)
    assert res.ArrivalSlippageBps > 1.9 && res.ArrivalSlippageBps < 2.1 : "Arrival slippage ~2 bps"
    assert res.ImplementationShortfallDollars > 32.9 && res.ImplementationShortfallDollars < 33.1 : "Shortfall ~$33.00"
  }

  private static function testSpreadMetrics() {
    var rec = SpreadMetrics.evaluateSpread("O1", Side.BUY, 100.05, 100.00, 100.03)
    assert java.lang.Math.abs(rec.EffectiveSpreadDollars - 0.10) < 0.001 : "Effective spread must be $0.10"
    assert java.lang.Math.abs(rec.RealizedSpreadDollars - 0.04) < 0.001 : "Realized spread must be $0.04"
    assert java.lang.Math.abs(rec.PriceImpactDollars - 0.06) < 0.001 : "Price impact must be $0.06"
  }

  private static function testMarkoutAnalyzer() {
    var m = new MarkoutAnalyzer()
    var r = m.createRecord("O1", VenueId.NASDAQ, Side.BUY, 100.00)
    r.recordHorizonMidpoint("1ms", 100.01)
    r.recordHorizonMidpoint("10ms", 100.02)
    r.recordHorizonMidpoint("100ms", 100.05)
    r.recordHorizonMidpoint("1s", 100.08)
    r.recordHorizonMidpoint("5s", 100.10)

    var means = m.computeMeanMarkoutByHorizon()
    assert java.lang.Math.abs(means.get("1ms") - 1.0) < 0.01 : "1ms markout ~1 bp"
    assert java.lang.Math.abs(means.get("5s") - 10.0) < 0.01 : "5s markout ~10 bps"
  }
}
