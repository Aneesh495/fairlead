package fairlead.enhancement

uses java.util.List
uses java.util.ArrayList

/**
 * Gosu enhancements for java.util.List providing high-order utility methods.
 */
enhancement CollectionEnhancement<T> : List<T> {
  function takeFirst(count : int) : List<T> {
    var result = new ArrayList<T>()
    var taken = 0
    for (item in this) {
      if (taken >= count) break
      result.add(item)
      taken++
    }
    return result
  }

  function toDelimitedString(delimiter : String) : String {
    var sb = new java.lang.StringBuilder()
    var first = true
    for (item in this) {
      if (!first) {
        sb.append(delimiter)
      }
      sb.append(item != null ? item.toString() : "")
      first = false
    }
    return sb.toString()
  }
}
