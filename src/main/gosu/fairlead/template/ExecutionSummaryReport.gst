<%@ params( orderId : String, symbol : String, side : String, totalShares : long, filledShares : long, avgPrice : double, arrivalPrice : double, slippageBps : double, totalFees : double, strategy : String ) %>
================================================================================
                       FAIRLEAD EXECUTION SUMMARY REPORT
================================================================================
Order ID:            <%= orderId %>
Symbol:              <%= symbol %>
Side:                <%= side %>
Strategy:            <%= strategy %>
Total Shares:        <%= totalShares %>
Filled Shares:       <%= filledShares %>
Leaves Shares:       <%= totalShares - filledShares %>
Arrival Price:       $<%= java.lang.String.format("%.4f", new Object[]{arrivalPrice}) %>
Average Fill Price:  $<%= java.lang.String.format("%.4f", new Object[]{avgPrice}) %>
Slippage vs Arrival: <%= java.lang.String.format("%.2f", new Object[]{slippageBps}) %> bps
Net Exchange Fees:   $<%= java.lang.String.format("%.2f", new Object[]{totalFees}) %>
Status:              <%= filledShares >= totalShares ? "COMPLETED (100% Filled)" : "PARTIAL FILL" %>
================================================================================
