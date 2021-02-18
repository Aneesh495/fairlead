# Regulation NMS Rule 611: Order Protection & Routing Specifications

## Overview of Regulation NMS

The National Market System (Reg NMS), promulgated by the Securities and Exchange Commission (SEC) under Release No. 34-51808, establishes modern equity market microstructure regulations in the United States. Its primary goal is to foster intermarket competition while ensuring fair, transparent, and non-discriminatory execution across all national securities exchanges and alternative trading systems (ATS).

Fairlead's smart order router natively integrates the four core pillars of Reg NMS:
1. **Rule 611 (Order Protection Rule)**: Strict trade-through prevention of automated protected quotations.
2. **Rule 610 (Access Fees)**: Cap of $0.0030 per share ($30 mils) on access fees and non-discriminatory access rules.
3. **Rule 612 (Sub-Penny Rule)**: Minimum price variation (MPV) rules of $0.01 for securities priced >= $1.00.
4. **Locked and Crossed Markets Rules**: Restrictions on displaying quotations that lock or cross protected quotations.

---

## SEC Rule 611: The Order Protection Rule

### Legal Standard

Rule 611 requires trading centers to establish, maintain, and enforce written policies and procedures reasonably designed to prevent "trade-throughs" - the execution of trades in an NMS stock at a price that is worse than the best protected bid or offer displayed by another trading center.

### Protected Quotations

A quotation is protected under Rule 611 only if it meets three statutory criteria:
1. **Automated Quotation**: The trading center provides immediate, automated response capabilities (typically sub-millisecond execution, cancellation, or acknowledgment without human intervention). Manual quotes are unprotectable.
2. **Displayed at the Top of Book**: Only the National Best Bid (NBB) and National Best Offer (NBO) of each protected quotation center are protected under federal law. Depth-of-book levels are not protected under Rule 611.
3. **Qualified Trading Center**: An exchange registered under Section 6(a) or an automated facility of FINRA (e.g. the ADF).

### Intermarket Sweep Orders (ISO)

The primary operational exception to Rule 611 is the Intermarket Sweep Order (ISO). Under Rule 600(b)(30), an ISO is a limit order for an NMS stock that is:
- Identified as an Intermarket Sweep Order when routed to a trading center (FIX Tag `40=2`, with `TimeInForce=IOC` or `TimeInForce=DAY` flagged as ISO).
- Dispatched simultaneously with one or more additional limit orders routed to execute against the full displayed size of all protected quotations superior or equal to the target execution price.

```mermaid
flowchart TD
    PARENT[Parent Buy Order: 5,000 shs Limit $180.05] --> SOR[Fairlead Rule 611 Router]
    
    subgraph ProtectedQuotes [Current Protected Quotation Centers]
        NBBO[NBBO: $179.99 x $180.01]
        EX1[NASDAQ: 800 shs @ $180.01]
        EX2[BATS: 600 shs @ $180.01]
        EX3[NYSE ARCA: 1,000 shs @ $180.02]
        EX4[EDGX: 1,200 shs @ $180.03]
    end
    
    SOR -->|1. Sweep NBBO (Full Displayed Depth)| ISO1[ISO Child 1: 800 shs to NASDAQ @ $180.01]
    SOR -->|1. Sweep NBBO (Full Displayed Depth)| ISO2[ISO Child 2: 600 shs to BATS @ $180.01]
    SOR -->|2. Sweep Higher Protected Venues| ISO3[ISO Child 3: 1,000 shs to ARCA @ $180.02]
    SOR -->|3. Sweep Up to Limit Price| ISO4[ISO Child 4: 1,200 shs to EDGX @ $180.03]
    SOR -->|4. Residual Balance: 1,400 shs| REST[Post Residual Display on Primary Venue]
```

Fairlead satisfies this mandate by computing required ISO slices across all lit quotation centers prior to releasing any slice. Slices are fired in parallel using asynchronous socket pipelines.

---

## SEC Rule 612: Sub-Penny Rule Compliance

SEC Rule 612 mandates minimum price variations (MPV) for quotations and orders:
- **Securities Priced >= $1.00**: Minimum price variation is strictly **$0.01** (1 cent).
- **Securities Priced < $1.00**: Minimum price variation is strictly **$0.0001** (0.01 cents / 1 pip).

### Exceptions
- **Midpoint Executions**: ATS venues and dark pools may execute at the exact sub-penny midpoint (e.g. $180.005) because midpoint executions are non-displayed and do not constitute an illegal sub-penny quote display.
- **Benchmark Fills**: VWAP/TWAP executions may print with fractional average prices.

Fairlead enforces Rule 612 in the `PriceCollarFilter.gs` pre-trade check: any displayed limit order with fractional cents on stocks >= $1.00 is rejected immediately before reaching the market.

---

## SEC Rule 610: Fee and Rebate Microeconomics

Rule 610 imposes a statutory cap on access fees: trading centers cannot assess fees exceeding **$0.0030 per share** (30 mils) for executions against protected quotations.

### Fee Models

1. **Maker-Taker (Traditional)**:
   - Aggressive liquidity taker pays a fee: $+0.0030$ / share.
   - Passive liquidity maker receives a rebate: $-0.0020$ / share.
   - Venues: NASDAQ, NYSE, BATS (BZX).

2. **Taker-Maker (Inverted)**:
   - Aggressive liquidity taker receives a rebate: $-0.0018$ / share.
   - Passive liquidity maker pays a fee: $+0.0020$ / share.
   - Venues: Cboe EDGA, NASDAQ BX.

### Cost-Aware Routing Formulation

Fairlead's `CostAwareRouter.gs` incorporates maker/taker economics directly into the execution objective function:

$$\min \sum_{v \in V} \left( P_v \cdot q_v + \text{Fee}_v(q_v) \right)$$

subject to:

$$\sum_{v \in V} q_v = Q_{\text{target}}$$

When liquidity is available at identical price levels across multiple venues, Fairlead routes first to inverted venues (e.g. EDGA) to harvest taker rebates before routing to traditional maker-taker venues.

---

## Locked and Crossed Markets

A locked market occurs when the National Best Bid equals the National Best Offer:

$$P_{\text{bid}} = P_{\text{ask}}$$

A crossed market occurs when the National Best Bid exceeds the National Best Offer:

$$P_{\text{bid}} > P_{\text{ask}}$$

### Causes
- Transmission latency differences across direct exchange feeds (e.g. SIP vs direct ITCH feeds).
- Rapid order cancellations in flight.
- Asymmetric venue queue processing.

### Synthetic Resolution in Fairlead

In `SyntheticNBBOEngine.gs`, Fairlead marks crossed books with `IsCrossed = true` and suppresses passive posting until quotes unlock. For smart order routing, crossed conditions present immediate synthetic arbitrage opportunities that Fairlead's sweep router exploits by taking overlapping liquidity concurrently.
