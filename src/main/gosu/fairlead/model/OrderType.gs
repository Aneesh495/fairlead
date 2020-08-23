package fairlead.model

/**
 * Supported order types for smart routing and algorithmic execution.
 */
enum OrderType {
  LIMIT,
  MARKET,
  PEGGED_MIDPOINT,
  PEGGED_PRIMARY,
  PEGGED_MARKET,
  ICEBERG

  public property get RequiresLimitPrice() : boolean {
    return this == LIMIT || this == ICEBERG
  }

  public property get IsPegged() : boolean {
    return this == PEGGED_MIDPOINT || this == PEGGED_PRIMARY || this == PEGGED_MARKET
  }

  public function toFixString() : String {
    switch (this) {
      case LIMIT: return "2"
      case MARKET: return "1"
      case PEGGED_MIDPOINT: return "P"
      case PEGGED_PRIMARY: return "R"
      case PEGGED_MARKET: return "M"
      case ICEBERG: return "d"
      default: return "2"
    }
  }

  public static function fromFixString(val : String) : OrderType {
    if (val == null) return LIMIT
    if (val == "2" || val.equalsIgnoreCase("LIMIT")) return LIMIT
    if (val == "1" || val.equalsIgnoreCase("MARKET")) return MARKET
    if (val == "P" || val.equalsIgnoreCase("PEGGED_MIDPOINT")) return PEGGED_MIDPOINT
    if (val == "R" || val.equalsIgnoreCase("PEGGED_PRIMARY")) return PEGGED_PRIMARY
    if (val == "M" || val.equalsIgnoreCase("PEGGED_MARKET")) return PEGGED_MARKET
    if (val == "d" || val.equalsIgnoreCase("ICEBERG")) return ICEBERG
    return LIMIT
  }
}
