package fairlead.enhancement

uses fairlead.model.PriceLevel

/**
 * Gosu enhancements for Double adding financial formatting and basis point conversions.
 */
enhancement FinancialMathEnhancement : java.lang.Double {
  function toDollarString() : String {
    return java.lang.String.format("$%.2f", new Object[]{this})
  }

  function toBpsString() : String {
    return java.lang.String.format("%.2f bps", new Object[]{this})
  }
}
