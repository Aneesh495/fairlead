package fairlead.protocol

/**
 * Standard FIX 4.4 and FIX 5.0 SP2 protocol tag definitions.
 */
class FIXTag {
  public static final var BeginString          : int = 8
  public static final var BodyLength           : int = 9
  public static final var CheckSum             : int = 10
  public static final var ClOrdID              : int = 11
  public static final var CumQty               : int = 14
  public static final var ExecID               : int = 17
  public static final var MsgSeqNum            : int = 34
  public static final var MsgType              : int = 35
  public static final var OrderID              : int = 37
  public static final var OrderQty             : int = 38
  public static final var OrdStatus            : int = 39
  public static final var OrdType              : int = 40
  public static final var OrigClOrdID          : int = 41
  public static final var Price                : int = 44
  public static final var SenderCompID         : int = 49
  public static final var SendingTime          : int = 52
  public static final var Side                 : int = 54
  public static final var Symbol               : int = 55
  public static final var TargetCompID         : int = 56
  public static final var TimeInForce          : int = 59
  public static final var TransactTime         : int = 60
  public static final var AvgPx                : int = 6
  public static final var LastPx               : int = 31
  public static final var LastQty              : int = 32
  public static final var ExecType             : int = 150
  public static final var LeavesQty            : int = 151
  public static final var Text                 : int = 58
  public static final var Account              : int = 1
}
