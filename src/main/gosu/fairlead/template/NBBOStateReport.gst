<%@ params( symbol : String, bidPx : double, bidSz : long, bidVenues : String, askPx : double, askSz : long, askVenues : String, spreadCents : double, microPrice : double ) %>
--------------------------------------------------------------------------------
                   SYNTHETIC CONSOLIDATED NBBO SNAPSHOT
--------------------------------------------------------------------------------
Symbol:              <%= symbol %>
National Best Bid:   $<%= java.lang.String.format("%.4f", new Object[]{bidPx}) %> (<%= bidSz %> shares on <%= bidVenues %>)
National Best Ask:   $<%= java.lang.String.format("%.4f", new Object[]{askPx}) %> (<%= askSz %> shares on <%= askVenues %>)
Consolidated Spread: <%= java.lang.String.format("%.2f", new Object[]{spreadCents}) %> cents
Order Micro-Price:   $<%= java.lang.String.format("%.4f", new Object[]{microPrice}) %>
Reg NMS Protection:  LIT PROTECTED QUOTATION CENTERS SYNCHRONIZED
--------------------------------------------------------------------------------
