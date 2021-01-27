package fairlead.model

/**
 * Order side representation with directional math and FIX protocol mapping.
 */
enum Side {
  BUY,
  SELL,
  SELL_SHORT,
  SELL_SHORT_EXEMPT

  public property get IsBuy() : boolean {
    return this == BUY
  }

  public property get IsSell() : boolean {
    return this == SELL || this == SELL_SHORT || this == SELL_SHORT_EXEMPT
  }

  public property get IsShort() : boolean {
    return this == SELL_SHORT || this == SELL_SHORT_EXEMPT
  }

  public function opposite() : Side {
    return this == BUY ? SELL : BUY
  }

  public function sign() : int {
    return this == BUY ? 1 : -1
  }

  public function toFixString() : String {
    switch (this) {
      case BUY: return "1"
      case SELL: return "2"
      case SELL_SHORT: return "5"
      case SELL_SHORT_EXEMPT: return "6"
      default: return "1"
    }
  }

  public static function fromFixString(val : String) : Side {
    if (val == null) return null
    if (val == "1" || val.equalsIgnoreCase("BUY") || val.equalsIgnoreCase("B")) {
      return BUY
    }
    if (val == "2" || val.equalsIgnoreCase("SELL") || val.equalsIgnoreCase("S")) {
      return SELL
    }
    if (val == "5" || val.equalsIgnoreCase("SELL_SHORT") || val.equalsIgnoreCase("SS")) {
      return SELL_SHORT
    }
    if (val == "6" || val.equalsIgnoreCase("SELL_SHORT_EXEMPT") || val.equalsIgnoreCase("SSX")) {
      return SELL_SHORT_EXEMPT
    }
    throw new java.lang.IllegalArgumentException("Unknown FIX Side: " + val)
  }
}
