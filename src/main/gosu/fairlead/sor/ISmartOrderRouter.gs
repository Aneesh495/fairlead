package fairlead.sor

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.VenueId
uses fairlead.marketdata.OrderBookLevel2
uses java.util.Map

/**
 * Common routing strategy interface for multi-venue smart order routing implementations.
 */
interface ISmartOrderRouter {
  property get StrategyName() : String
  function route(order : Order, nbbo : NBBO, books : Map<VenueId, OrderBookLevel2>) : RoutingDecision
}
