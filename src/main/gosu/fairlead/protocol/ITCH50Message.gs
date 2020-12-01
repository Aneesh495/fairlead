package fairlead.protocol

uses fairlead.model.Side

/**
 * NASDAQ TotalView-ITCH 5.0 binary protocol message representation.
 */
class ITCH50Message {
  var _messageType : char as MessageType
  var _timestampNs : long as TimestampNs
  var _orderReferenceNumber : long as OrderReferenceNumber
  var _side : Side as Side
  var _shares : long as Shares
  var _stock : String as Stock
  var _price : long as Price // 4-decimal fixed point
  var _newOrderReferenceNumber : long as NewOrderReferenceNumber
  var _matchNumber : long as MatchNumber

  construct(type : char) {
    _messageType = type
  }

  override function toString() : String {
    return "ITCH50['" + _messageType + "' ref=" + _orderReferenceNumber + " " + _stock + " " +
           _side + " " + _shares + " @ " + (_price as double)/10000.0 + "]"
  }
}
