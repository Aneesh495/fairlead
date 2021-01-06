package fairlead.test

uses fairlead.marketdata.OrderBookLevel2
uses fairlead.marketdata.OrderBookLevel3
uses fairlead.model.Side
uses fairlead.model.VenueId
uses fairlead.model.PriceLevel

/**
 * Unit test suite verifying Level 2 depth ladders and Level 3 FIFO queue position mechanics.
 */
class OrderBookUnitTest {
  public static function run() : boolean {
    print("  -> Running OrderBookUnitTest...")
    testLevel2BookDepth()
    testLevel2VWAPCalculation()
    testLevel3QueuePriorityTracking()
    return true
  }

  private static function testLevel2BookDepth() {
    var book = new OrderBookLevel2(VenueId.NASDAQ, "NVDA")
    var now = java.lang.System.nanoTime()

    book.updateLevel(Side.BUY, PriceLevel.fromDouble(120.00), 500L, 2, now, 1L)
    book.updateLevel(Side.BUY, PriceLevel.fromDouble(119.98), 800L, 3, now, 2L)
    book.updateLevel(Side.SELL, PriceLevel.fromDouble(120.02), 400L, 1, now, 3L)
    book.updateLevel(Side.SELL, PriceLevel.fromDouble(120.05), 1000L, 4, now, 4L)

    assert book.BestBidPrice == PriceLevel.fromDouble(120.00) : "Best bid must be 120.00"
    assert book.BestAskPrice == PriceLevel.fromDouble(120.02) : "Best ask must be 120.02"
    assert book.BestBidSize == 500L : "Best bid size must be 500"
    assert book.BestAskSize == 400L : "Best ask size must be 400"

    var bidDepth = book.getBidDepth(5)
    assert bidDepth.size() == 2 : "Must have 2 bid levels"
    assert bidDepth.get(0).Price == PriceLevel.fromDouble(120.00) : "First bid level 120.00"
    assert bidDepth.get(1).Price == PriceLevel.fromDouble(119.98) : "Second bid level 119.98"
  }

  private static function testLevel2VWAPCalculation() {
    var book = new OrderBookLevel2(VenueId.BATS, "AAPL")
    var now = java.lang.System.nanoTime()

    book.updateLevel(Side.SELL, PriceLevel.fromDouble(150.00), 500L, 1, now, 1L)
    book.updateLevel(Side.SELL, PriceLevel.fromDouble(150.02), 500L, 1, now, 2L)

    // Sweeping 1000 shares across 500 @ 150.00 and 500 @ 150.02 -> VWAP = 150.01
    var vwap = book.computeBookVWAP(Side.BUY, 1000L)
    assert java.lang.Math.abs(vwap - 150.01) < 0.0001 : "VWAP must be exactly 150.01"
  }

  private static function testLevel3QueuePriorityTracking() {
    var book = new OrderBookLevel3(VenueId.NASDAQ, "MSFT")
    var now = java.lang.System.nanoTime()

    book.addOrder("ORD-1", Side.BUY, PriceLevel.fromDouble(400.00), 500L, now, 1L)
    book.addOrder("ORD-2", Side.BUY, PriceLevel.fromDouble(400.00), 300L, now, 2L)
    book.addOrder("ORD-3", Side.BUY, PriceLevel.fromDouble(400.00), 200L, now, 3L)

    assert book.getQueuePositionAhead("ORD-1") == 0L : "ORD-1 has 0 volume ahead"
    assert book.getQueuePositionAhead("ORD-2") == 500L : "ORD-2 has 500 volume ahead"
    assert book.getQueuePositionAhead("ORD-3") == 800L : "ORD-3 has 800 volume ahead"

    // Partial execute of ORD-1 (200 shares)
    book.executeOrder("ORD-1", 200L, now, 4L)
    assert book.getQueuePositionAhead("ORD-2") == 300L : "ORD-2 now has 300 volume ahead"
    assert book.getQueuePositionAhead("ORD-3") == 600L : "ORD-3 now has 600 volume ahead"

    // Cancel ORD-2
    book.cancelOrder("ORD-2", 300L, now, 5L)
    assert book.getQueuePositionAhead("ORD-3") == 300L : "ORD-3 now has 300 volume ahead after ORD-2 cancel"
  }
}
