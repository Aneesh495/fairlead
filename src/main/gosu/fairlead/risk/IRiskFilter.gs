package fairlead.risk

uses fairlead.model.Order
uses fairlead.model.NBBO

/**
 * Filter contract for pre-trade risk controls under SEC Rule 15c3-5.
 */
interface IRiskFilter {
  property get FilterName() : String
  function evaluate(order : Order, nbbo : NBBO) : RiskCheckResult
}
