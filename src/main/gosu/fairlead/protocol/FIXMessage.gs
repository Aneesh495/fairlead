package fairlead.protocol

uses java.util.Map
uses java.util.LinkedHashMap

/**
 * Parsed FIX protocol message entity maintaining ordered tag-value pairs.
 */
class FIXMessage {
  var _fields : Map<Integer, String> as Fields

  construct() {
    _fields = new LinkedHashMap<Integer, String>()
  }

  public function set(tag : int, val : String) : FIXMessage {
    _fields.put(tag, val)
    return this
  }

  public function get(tag : int) : String {
    return _fields.get(tag)
  }

  public function getInt(tag : int, defaultVal : int) : int {
    var s = _fields.get(tag)
    if (s == null) return defaultVal
    try {
      return java.lang.Integer.parseInt(s)
    } catch (e : java.lang.Exception) {
      return defaultVal
    }
  }

  public function getLong(tag : int, defaultVal : long) : long {
    var s = _fields.get(tag)
    if (s == null) return defaultVal
    try {
      return java.lang.Long.parseLong(s)
    } catch (e : java.lang.Exception) {
      return defaultVal
    }
  }

  public function getDouble(tag : int, defaultVal : double) : double {
    var s = _fields.get(tag)
    if (s == null) return defaultVal
    try {
      return java.lang.Double.parseDouble(s)
    } catch (e : java.lang.Exception) {
      return defaultVal
    }
  }

  public property get MsgType() : String {
    return _fields.get(FIXTag.MsgType)
  }

  public property get ClOrdID() : String {
    return _fields.get(FIXTag.ClOrdID)
  }

  public property get Symbol() : String {
    return _fields.get(FIXTag.Symbol)
  }

  override function toString() : String {
    var sb = new java.lang.StringBuilder()
    for (entry in _fields.entrySet()) {
      sb.append(entry.getKey()).append("=").append(entry.getValue()).append("|")
    }
    return sb.toString()
  }
}
