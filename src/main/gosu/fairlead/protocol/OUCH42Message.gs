package fairlead.protocol

uses fairlead.model.Side
uses java.nio.ByteBuffer
uses java.nio.charset.StandardCharsets

/**
 * NASDAQ OUCH 4.2 binary order entry protocol message encoder and decoder.
 * Provides microsecond-level order entry, execution acknowledgement, and cancellation framing.
 */
class OUCH42Message {
  var _packetType : char as PacketType
  var _userRefNumber : long as UserRefNumber
  var _orderToken : String as OrderToken
  var _side : Side as Side
  var _shares : long as Shares
  var _stock : String as Stock
  var _price : long as Price // 4-decimal fixed point
  var _liquidityFlag : char as LiquidityFlag // 'A' = Added (Maker), 'R' = Removed (Taker)
  var _matchNumber : long as MatchNumber

  construct(type : char) {
    _packetType = type
  }

  public static function encodeEnterOrder(userRef : long, isBuy : boolean, shares : int, symbol : String, price : int) : ByteBuffer {
    var buf = ByteBuffer.allocate(48)
    buf.put('O' as byte) // Packet Type 'O' = Enter Order
    buf.putLong(userRef)
    buf.put((isBuy ? 'B' : 'S') as byte)
    buf.putInt(shares)

    var symBytes = new byte[8]
    java.util.Arrays.fill(symBytes, ' ' as byte)
    var rawSym = symbol.getBytes(StandardCharsets.US_ASCII)
    java.lang.System.arraycopy(rawSym, 0, symBytes, 0, java.lang.Math.min(8, rawSym.length))
    buf.put(symBytes)

    buf.putInt(price)
    buf.putInt(99999) // Display quantity
    buf.put('0' as byte) // TimeInForce '0' = Day
    buf.put("FAIR".getBytes(StandardCharsets.US_ASCII)) // Firm ID 4 bytes
    buf.put('Y' as byte) // Display flag
    buf.put('A' as byte) // Capacity 'A' = Agency
    buf.put('N' as byte) // Intermarket Sweep Order 'N' = No
    buf.flip()
    return buf
  }

  public static function parse(buf : ByteBuffer) : OUCH42Message {
    if (buf == null || buf.remaining() < 1) return null
    var type = buf.get() as char
    var msg = new OUCH42Message(type)

    switch (type) {
      case 'O': // Enter Order
        msg.UserRefNumber = buf.getLong()
        var side = buf.get() as char
        msg.Side = side == 'B' ? Side.BUY : Side.SELL
        msg.Shares = buf.getInt() as long
        var symBytes = new byte[8]
        buf.get(symBytes)
        msg.Stock = new java.lang.String(symBytes, StandardCharsets.US_ASCII).trim()
        msg.Price = buf.getInt() as long
        break

      case 'E': // Order Executed
        buf.getLong() // Timestamp
        var tokenBytes = new byte[14]
        buf.get(tokenBytes)
        msg.OrderToken = new java.lang.String(tokenBytes, StandardCharsets.US_ASCII).trim()
        msg.Shares = buf.getInt() as long
        msg.Price = buf.getInt() as long
        msg.LiquidityFlag = buf.get() as char
        msg.MatchNumber = buf.getLong()
        break

      default:
        break
    }

    return msg
  }

  override function toString() : String {
    return "OUCH42['" + _packetType + "' ref=" + _userRefNumber + " " + _stock + " " +
           _side + " " + _shares + " @ " + (_price as double)/10000.0 + "]"
  }
}
