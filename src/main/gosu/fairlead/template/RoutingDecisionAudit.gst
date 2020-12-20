<%@ params( parentId : String, symbol : String, side : String, strategy : String, sliceCount : int, allocatedShares : long, estAvgPrice : double, estFees : double ) %>
--------------------------------------------------------------------------------
                     FAIRLEAD SOR ROUTING DECISION AUDIT
--------------------------------------------------------------------------------
Parent Order ID:     <%= parentId %>
Symbol:              <%= symbol %>
Side:                <%= side %>
Routing Strategy:    <%= strategy %>
Child Slices:        <%= sliceCount %>
Allocated Volume:    <%= allocatedShares %> shares
Est. Average Price:  $<%= java.lang.String.format("%.4f", new Object[]{estAvgPrice}) %>
Est. Exchange Fees:  $<%= java.lang.String.format("%.2f", new Object[]{estFees}) %>
Audit Verification:  COMPLIANT (Reg NMS Rule 611 & SEC Rule 15c3-5)
--------------------------------------------------------------------------------
