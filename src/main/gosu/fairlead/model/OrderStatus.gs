package fairlead.model

/**
 * Lifecycle states of parent and routed child orders with legal transition validation.
 */
enum OrderStatus {
  PENDING_NEW,
  NEW,
  PARTIALLY_FILLED,
  FILLED,
  PENDING_CANCEL,
  CANCELED,
  REJECTED,
  EXPIRED

  public property get IsTerminal() : boolean {
    return this == FILLED || this == CANCELED || this == REJECTED || this == EXPIRED
  }

  public property get IsActive() : boolean {
    return !IsTerminal
  }

  public function canTransitionTo(target : OrderStatus) : boolean {
    if (this == target) return true
    if (this.IsTerminal) return false

    switch (this) {
      case PENDING_NEW:
        return target == NEW || target == REJECTED || target == CANCELED || target == FILLED
      case NEW:
        return target == PARTIALLY_FILLED || target == FILLED || target == PENDING_CANCEL || target == CANCELED || target == EXPIRED
      case PARTIALLY_FILLED:
        return target == PARTIALLY_FILLED || target == FILLED || target == PENDING_CANCEL || target == CANCELED || target == EXPIRED
      case PENDING_CANCEL:
        return target == CANCELED || target == FILLED || target == PARTIALLY_FILLED
      default:
        return false
    }
  }

  public function toFixString() : String {
    switch (this) {
      case PENDING_NEW: return "A"
      case NEW: return "0"
      case PARTIALLY_FILLED: return "1"
      case FILLED: return "2"
      case PENDING_CANCEL: return "6"
      case CANCELED: return "4"
      case REJECTED: return "8"
      case EXPIRED: return "C"
      default: return "0"
    }
  }

  public static function fromFixString(val : String) : OrderStatus {
    if (val == null) return NEW
    if (val == "A" || val.equalsIgnoreCase("PENDING_NEW")) return PENDING_NEW
    if (val == "0" || val.equalsIgnoreCase("NEW")) return NEW
    if (val == "1" || val.equalsIgnoreCase("PARTIALLY_FILLED")) return PARTIALLY_FILLED
    if (val == "2" || val.equalsIgnoreCase("FILLED")) return FILLED
    if (val == "6" || val.equalsIgnoreCase("PENDING_CANCEL")) return PENDING_CANCEL
    if (val == "4" || val.equalsIgnoreCase("CANCELED")) return CANCELED
    if (val == "8" || val.equalsIgnoreCase("REJECTED")) return REJECTED
    if (val == "C" || val.equalsIgnoreCase("EXPIRED")) return EXPIRED
    return NEW
  }
}
