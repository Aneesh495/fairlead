package fairlead.algo

uses fairlead.model.Order
uses fairlead.model.NBBO
uses fairlead.model.FillAllocation

/**
 * Strategy interface for multi-period algorithmic execution scheduling.
 */
interface IExecutionStrategy {
  property get StrategyName() : String
  function computeNextSlice(parentOrder : Order, progress : ExecutionProgress, nbbo : NBBO) : FillAllocation
  function isScheduleComplete(progress : ExecutionProgress) : boolean
}
