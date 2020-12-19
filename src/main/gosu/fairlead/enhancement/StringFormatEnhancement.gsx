package fairlead.enhancement

/**
 * Gosu enhancements for String adding fixed-width alignment and truncation routines.
 */
enhancement StringFormatEnhancement : java.lang.String {
  function padRight(width : int) : String {
    if (this.length() >= width) return this
    var sb = new java.lang.StringBuilder(this)
    while (sb.length() < width) {
      sb.append(' ')
    }
    return sb.toString()
  }

  function padLeft(width : int) : String {
    if (this.length() >= width) return this
    var sb = new java.lang.StringBuilder()
    var needed = width - this.length()
    for (i in 1..needed) {
      sb.append(' ')
    }
    sb.append(this)
    return sb.toString()
  }

  function truncate(maxLen : int) : String {
    if (this.length() <= maxLen) return this
    return this.substring(0, maxLen)
  }
}
