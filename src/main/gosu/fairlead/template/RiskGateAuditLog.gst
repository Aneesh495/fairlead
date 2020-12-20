<%@ params( orderId : String, account : String, traderId : String, filterCount : int, resultStatus : String, details : String ) %>
--------------------------------------------------------------------------------
                  SEC RULE 15c3-5 PRE-TRADE RISK AUDIT LOG
--------------------------------------------------------------------------------
Order Reference:     <%= orderId %>
Account ID:          <%= account %>
Trader ID:           <%= traderId %>
Filters Evaluated:   <%= filterCount %>
Validation Outcome:  <%= resultStatus %>
Compliance Details:  <%= details %>
Timestamp:           2026-11-14T12:00:00Z
Certification:       PASS - Authorized for Outbound Market Routing
--------------------------------------------------------------------------------
