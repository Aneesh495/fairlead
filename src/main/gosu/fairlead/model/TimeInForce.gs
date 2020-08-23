package fairlead.model

/**
 * Time in force constraints governing order lifetime and cancellation behavior.
 */
enum TimeInForce {
  DAY,
  IOC,
  FOK,
  GTC,
  GTD

  public property get IsImmediate() : boolean {
    return this == IOC || this == FOK
  }

  public function toFixString() : String {
    switch (this) {
      case DAY: return "0"
      case GTC: return "1"
      case IOC: return "3"
      case FOK: return "4"
      case GTD: return "6"
      default: return "0"
    }
  }

  public static function fromFixString(val : String) : TimeInForce {
    if (val == null) return DAY
    if (val == "0" || val.equalsIgnoreCase("DAY")) return DAY
    if (val == "1" || val.equalsIgnoreCase("GTC")) return GTC
    if (val == "3" || val.equalsIgnoreCase("IOC")) return IOC
    if (val == "4" || val.equalsIgnoreCase("FOK")) return FOK
    if (val == "6" || val.equalsIgnoreCase("GTD")) return GTD
    return DAY
  }
}
