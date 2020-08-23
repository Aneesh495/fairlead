package fairlead.model

/**
 * Order side representation with directional math and FIX protocol mapping.
 */
enum Side {
  BUY,
  SELL

  public property get IsBuy() : boolean {
    return this == BUY
  }

  public property get IsSell() : boolean {
    return this == SELL
  }

  public function opposite() : Side {
    return this == BUY ? SELL : BUY
  }

  public function sign() : int {
    return this == BUY ? 1 : -1
  }

  public function toFixString() : String {
    return this == BUY ? "1" : "2"
  }

  public static function fromFixString(val : String) : Side {
    if (val == null) return null
    if (val == "1" || val.equalsIgnoreCase("BUY") || val.equalsIgnoreCase("B")) {
      return BUY
    }
    if (val == "2" || val.equalsIgnoreCase("SELL") || val.equalsIgnoreCase("S")) {
      return SELL
    }
    throw new java.lang.IllegalArgumentException("Unknown FIX Side: " + val)
  }
}
