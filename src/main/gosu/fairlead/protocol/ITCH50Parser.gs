package fairlead.protocol

uses fairlead.model.Side
uses java.nio.ByteBuffer
uses java.nio.charset.StandardCharsets

/**
 * Ultra-low latency binary decoder for NASDAQ TotalView-ITCH 5.0 direct market data feeds.
 */
class ITCH50Parser {
  public static function parse(buffer : ByteBuffer) : ITCH50Message {
    if (buffer == null || buffer.remaining() < 1) {
      return null
    }

    var msgType = buffer.get() as char
    var msg = new ITCH50Message(msgType)

    switch (msgType) {
      case 'A': // Add Order Message (36 bytes)
        buffer.getShort() // Stock Locate
        buffer.getShort() // Tracking Number
        msg.TimestampNs = read48BitTimestamp(buffer)
        msg.OrderReferenceNumber = buffer.getLong()
        var sideChar = buffer.get() as char
        msg.Side = sideChar == 'B' ? Side.BUY : Side.SELL
        msg.Shares = buffer.getInt() as long
        msg.Stock = readPaddedAsciiString(buffer, 8)
        msg.Price = buffer.getInt() as long // 4-decimal integer price
        break

      case 'E': // Order Executed Message (31 bytes)
        buffer.getShort() // Locate
        buffer.getShort() // Tracking
        msg.TimestampNs = read48BitTimestamp(buffer)
        msg.OrderReferenceNumber = buffer.getLong()
        msg.Shares = buffer.getInt() as long
        msg.MatchNumber = buffer.getLong()
        break

      case 'X': // Order Cancel Message (23 bytes)
        buffer.getShort()
        buffer.getShort()
        msg.TimestampNs = read48BitTimestamp(buffer)
        msg.OrderReferenceNumber = buffer.getLong()
        msg.Shares = buffer.getInt() as long
        break

      case 'D': // Order Delete Message (19 bytes)
        buffer.getShort()
        buffer.getShort()
        msg.TimestampNs = read48BitTimestamp(buffer)
        msg.OrderReferenceNumber = buffer.getLong()
        break

      case 'U': // Order Replace Message (35 bytes)
        buffer.getShort()
        buffer.getShort()
        msg.TimestampNs = read48BitTimestamp(buffer)
        msg.OrderReferenceNumber = buffer.getLong()
        msg.NewOrderReferenceNumber = buffer.getLong()
        msg.Shares = buffer.getInt() as long
        msg.Price = buffer.getInt() as long
        break

      default:
        // Other NASDAQ message types ('S', 'P', 'Q', 'B', etc.)
        break
    }

    return msg
  }

  private static function read48BitTimestamp(buf : ByteBuffer) : long {
    var high = (buf.getShort() as long) & 0xFFFFL
    var low = (buf.getInt() as long) & 0xFFFFFFFFL
    return (high << 32) | low
  }

  private static function readPaddedAsciiString(buf : ByteBuffer, len : int) : String {
    var bytes = new byte[len]
    buf.get(bytes)
    return new java.lang.String(bytes, StandardCharsets.US_ASCII).trim()
  }

  public static function encodeAddOrder(orderRef : long, isBuy : boolean, shares : int, symbol : String, price : int) : ByteBuffer {
    var buf = ByteBuffer.allocate(36)
    buf.put('A' as byte)
    buf.putShort(1 as short) // Locate
    buf.putShort(0 as short) // Tracking
    // 48-bit timestamp
    buf.putShort(0 as short)
    buf.putInt(123456789)
    buf.putLong(orderRef)
    buf.put((isBuy ? 'B' : 'S') as byte)
    buf.putInt(shares)
    // 8 bytes symbol
    var symBytes = new byte[8]
    java.util.Arrays.fill(symBytes, ' ' as byte)
    var rawSym = symbol.getBytes(StandardCharsets.US_ASCII)
    java.lang.System.arraycopy(rawSym, 0, symBytes, 0, java.lang.Math.min(8, rawSym.length))
    buf.put(symBytes)
    buf.putInt(price)
    buf.flip()
    return buf
  }
}
