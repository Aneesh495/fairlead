package fairlead.model

/**
 * Execution venue definitions across lit equity exchanges, inverted venues, and dark pools.
 */
enum VenueId {
  NASDAQ("XNAS", "Nasdaq", false, false, 120, 0.0030, 0.0020),
  NYSE("XNYS", "New York Stock Exchange", false, false, 180, 0.0030, 0.0018),
  BATS("BATS", "Cboe BZX Exchange", false, false, 110, 0.0030, 0.0022),
  ARCA("ARCX", "NYSE Arca", false, false, 150, 0.0030, 0.0020),
  EDGX("EDGX", "Cboe EDGX Exchange", false, false, 115, 0.0030, 0.0020),
  EDGA("EDGA", "Cboe EDGA Exchange (Inverted)", false, true, 115, -0.0018, -0.0030),
  IEX("IEXG", "Investors Exchange (350us Speed Bump)", false, false, 470, 0.0009, 0.0000),
  DARK_POOL_A("DPA1", "Internal Midpoint Crossing Engine", true, false, 40, 0.0000, 0.0000),
  DARK_POOL_B("DPB2", "External Institutional Dark Pool", true, false, 600, 0.0005, 0.0000)

  var _mic : String as MicCode
  var _name : String as VenueName
  var _dark : boolean as IsDarkPool
  var _inverted : boolean as IsInverted
  var _latency : long as BaseLatencyMicros
  var _takerFee : double as DefaultTakerFee
  var _makerRebate : double as DefaultMakerRebate

  private construct(mic : String, name : String, dark : boolean, inverted : boolean, latency : long, takerFee : double, makerRebate : double) {
    _mic = mic
    _name = name
    _dark = dark
    _inverted = inverted
    _latency = latency
    _takerFee = takerFee
    _makerRebate = makerRebate
  }

  public property get IsProtectedQuoteVenue() : boolean {
    // Under Reg NMS Rule 611, only automated lit public quotation centers display protected quotes
    return !_dark
  }

  public static function parse(id : String) : VenueId {
    if (id == null) return null
    var clean = id.trim().toUpperCase()
    for (v in VenueId.values()) {
      if (v.name() == clean || v.MicCode == clean) {
        return v
      }
    }
    throw new java.lang.IllegalArgumentException("Unknown venue identifier: " + id)
  }
}
