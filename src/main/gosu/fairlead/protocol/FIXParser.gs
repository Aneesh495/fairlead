package fairlead.protocol

/**
 * High-speed parser for raw SOH-delimited (and pipe-delimited) FIX protocol message strings.
 */
class FIXParser {
  public static function parse(raw : String) : FIXMessage {
    if (raw == null || raw.trim().isEmpty()) {
      return null
    }

    var msg = new FIXMessage()
    var delimiter = raw.indexOf('\u0001') >= 0 ? '\u0001' : '|'
    var len = raw.length()
    var start = 0

    while (start < len) {
      var nextDelim = raw.indexOf(delimiter, start)
      if (nextDelim < 0) {
        nextDelim = len
      }

      var token = raw.substring(start, nextDelim).trim()
      if (!token.isEmpty()) {
        var eqIdx = token.indexOf('=')
        if (eqIdx > 0 && eqIdx < token.length() - 1) {
          try {
            var tag = java.lang.Integer.parseInt(token.substring(0, eqIdx))
            var val = token.substring(eqIdx + 1)
            msg.set(tag, val)
          } catch (e : java.lang.Exception) {
            // Skip malformed tag
          }
        }
      }

      start = nextDelim + 1
    }

    return msg
  }
}
