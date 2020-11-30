package fairlead.protocol

uses fairlead.model.Order
uses fairlead.model.ExecutionReport

/**
 * Serializer and constructor for outbound FIX protocol messages (ExecutionReports, NewOrderSingle).
 * Automatically computes standard FIX BodyLength (Tag 9) and 3-digit CheckSum (Tag 10).
 */
class FIXBuilder {
  public static function buildExecutionReport(exec : ExecutionReport, seqNum : long, senderComp : String, targetComp : String) : String {
    var body = new java.lang.StringBuilder()
    appendField(body, FIXTag.MsgType, "8")
    appendField(body, FIXTag.SenderCompID, senderComp != null ? senderComp : "FAIRLEAD")
    appendField(body, FIXTag.TargetCompID, targetComp != null ? targetComp : "CLIENT")
    appendField(body, FIXTag.MsgSeqNum, "" + seqNum)
    appendField(body, FIXTag.SendingTime, "20261114-12:00:00.000")
    appendField(body, FIXTag.OrderID, exec.OrderId)
    appendField(body, FIXTag.ClOrdID, exec.ClOrdId)
    appendField(body, FIXTag.ExecID, exec.ExecId)
    appendField(body, FIXTag.ExecType, exec.Status.toFixString())
    appendField(body, FIXTag.OrdStatus, exec.Status.toFixString())
    appendField(body, FIXTag.Symbol, exec.Symbol)
    appendField(body, FIXTag.Side, exec.Side.toFixString())
    appendField(body, FIXTag.LastQty, "" + exec.LastShares)
    appendField(body, FIXTag.LastPx, java.lang.String.format("%.4f", new Object[]{exec.LastPx}))
    appendField(body, FIXTag.LeavesQty, "" + exec.LeavesShares)
    appendField(body, FIXTag.CumQty, "" + exec.CumShares)
    appendField(body, FIXTag.AvgPx, java.lang.String.format("%.4f", new Object[]{exec.AvgPx}))
    if (exec.Text != null && !exec.Text.isEmpty()) {
      appendField(body, FIXTag.Text, exec.Text)
    }

    var bodyStr = body.toString()
    var header = "8=FIX.4.4\u00019=" + bodyStr.length() + "\u0001"
    var fullWithoutChecksum = header + bodyStr

    var checksum = computeChecksum(fullWithoutChecksum)
    return fullWithoutChecksum + "10=" + checksum + "\u0001"
  }

  private static function appendField(sb : java.lang.StringBuilder, tag : int, val : String) {
    sb.append(tag).append("=").append(val).append("\u0001")
  }

  public static function computeChecksum(msg : String) : String {
    var sum = 0
    var bytes = msg.getBytes(java.nio.charset.StandardCharsets.US_ASCII)
    for (b in bytes) {
      sum += (b & 0xFF)
    }
    var check = sum % 256
    return java.lang.String.format("%03d", new Object[]{check})
  }
}
