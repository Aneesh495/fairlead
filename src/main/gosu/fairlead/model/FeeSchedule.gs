package fairlead.model

uses java.util.Map
uses java.util.HashMap

/**
 * Economic fee and rebate schedule models across maker-taker lit exchanges, inverted venues,
 * dark pools, and regulatory clearing fees (FINRA TAF and SEC Section 31).
 */
class FeeSchedule {
  public static final var SEC_SECTION_31_RATE : double = 0.0000278 // Applicable on sell orders
  public static final var FINRA_TAF_PER_SHARE : double = 0.000166  // Max $8.30 per transaction
  public static final var FINRA_TAF_MAX_CAP   : double = 8.30

  var _takerFeeMap : Map<VenueId, Double> as TakerFees
  var _makerRebateMap : Map<VenueId, Double> as MakerRebates

  construct() {
    _takerFeeMap = new HashMap<VenueId, Double>()
    _makerRebateMap = new HashMap<VenueId, Double>()
    initializeDefaultTiers()
  }

  private function initializeDefaultTiers() {
    for (v in VenueId.values()) {
      _takerFeeMap.put(v, v.DefaultTakerFee)
      _makerRebateMap.put(v, v.DefaultMakerRebate)
    }
  }

  public function getTakerFeeRate(venue : VenueId) : double {
    var fee = _takerFeeMap.get(venue)
    return fee != null ? fee : venue.DefaultTakerFee
  }

  public function getMakerRebateRate(venue : VenueId) : double {
    var rebate = _makerRebateMap.get(venue)
    return rebate != null ? rebate : venue.DefaultMakerRebate
  }

  public function setCustomTakerFee(venue : VenueId, fee : double) {
    _takerFeeMap.put(venue, fee)
  }

  public function setCustomMakerRebate(venue : VenueId, rebate : double) {
    _makerRebateMap.put(venue, rebate)
  }

  public function computeExchangeFeeOrRebate(venue : VenueId, shares : long, isMaker : boolean) : double {
    if (isMaker) {
      // Maker rebate is received as negative cost
      var rate = getMakerRebateRate(venue)
      return -(rate * (shares as double))
    } else {
      // Taker fee is paid as positive cost
      var rate = getTakerFeeRate(venue)
      return rate * (shares as double)
    }
  }

  public function computeRegulatoryClearingFee(side : Side, shares : long, price : double) : double {
    var total = 0.0
    // FINRA Trading Activity Fee on all sales
    if (side == Side.SELL) {
      var taf = (shares as double) * FINRA_TAF_PER_SHARE
      total += java.lang.Math.min(taf, FINRA_TAF_MAX_CAP)
      // SEC Section 31 Fee on gross principal of sales
      var principal = (shares as double) * price
      total += principal * SEC_SECTION_31_RATE
    }
    return total
  }

  public function computeNetAllInCost(venue : VenueId, side : Side, shares : long, price : double, isMaker : boolean) : double {
    var exchangeNet = computeExchangeFeeOrRebate(venue, shares, isMaker)
    var regFee = computeRegulatoryClearingFee(side, shares, price)
    return exchangeNet + regFee
  }

  public function computeEffectivePrice(side : Side, rawPrice : double, shares : long, venue : VenueId, isMaker : boolean) : double {
    if (shares <= 0L) return rawPrice
    var netCost = computeNetAllInCost(venue, side, shares, rawPrice, isMaker)
    var costPerShare = netCost / (shares as double)
    return side == Side.BUY ? (rawPrice + costPerShare) : (rawPrice - costPerShare)
  }
}
