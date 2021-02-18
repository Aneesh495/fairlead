# Fairlead Wire Protocols: FRLD-1 Binary, FIX 4.4, ITCH 5.0, OUCH 4.2

Fairlead provides native, sub-microsecond serialization and deserialization codecs for institutional exchange protocols:
1. **FRLD-1**: Ultra-compact binary wire protocol with hardware CRC-32C frame validation.
2. **FIX 4.4**: Financial Information eXchange tag-value protocol.
3. **NASDAQ TotalView-ITCH 5.0**: Exchange direct market data dissemination protocol.
4. **NASDAQ OUCH 4.2**: Direct order entry and execution report protocol.

---

## 1. FRLD-1 Binary Protocol Specification

FRLD-1 is an ultra-low latency, fixed-layout binary framing format designed for point-to-point IPC and network transport between feed handlers, risk gates, and matching cores.

### Frame Layout

All multi-byte integer fields are encoded in **Big-Endian** network byte order.

```
+-------------------------------------------------------------------------------+
| Offset | Field Name    | Data Type | Length  | Description                    |
+-------------------------------------------------------------------------------+
| 0      | MagicBytes    | uint32_t  | 4 bytes | Protocol Magic: 0x46524C44     |
| 4      | Version       | uint8_t   | 1 byte  | Protocol Version (0x01)        |
| 5      | MessageType   | uint8_t   | 1 byte  | Message Type Identifier        |
| 6      | Reserved      | uint16_t  | 2 bytes | 16-bit alignment padding (0x00)|
| 8      | BodyLength    | uint32_t  | 4 bytes | Payload length in bytes        |
| 12     | TimestampNs   | int64_t   | 8 bytes | UNIX epoch nanoseconds         |
| 20     | Checksum      | uint32_t  | 4 bytes | Hardware CRC-32C of body       |
+-------------------------------------------------------------------------------+
| 24     | Payload       | byte[]    | N bytes | Message-specific payload       |
+-------------------------------------------------------------------------------+
```

### Message Types

| Message Type | Code | Payload Layout |
|:---|:---:|:---|
| `QUOTE_UPDATE` | `0x01` | Symbol (8B ASCII) + Venue (2B) + BidPx (8B) + BidSz (8B) + AskPx (8B) + AskSz (8B) + Seq (8B) |
| `ORDER_SUBMIT` | `0x02` | ClOrdId (16B ASCII) + Symbol (8B ASCII) + Side (1B) + Type (1B) + TIF (1B) + Px (8B) + Qty (8B) |
| `EXEC_REPORT` | `0x03` | ExecId (16B ASCII) + OrderId (16B ASCII) + Status (1B) + LastPx (8B) + LastQty (8B) + LeavesQty (8B) |
| `CANCEL_REQ` | `0x04` | OrigClOrdId (16B ASCII) + ClOrdId (16B ASCII) + Symbol (8B ASCII) |

### CRC-32C Validation

Checksum validation utilizes the Castagnoli polynomial `0x82F63B78` (`0x1EDC6F41` reversed):

$$P(x) = x^{32} + x^{28} + x^{27} + x^{26} + x^{25} + x^{23} + x^{22} + x^{20} + x^{19} + x^{18} + x^{14} + x^{13} + x^{11} + x^{10} + x^9 + x^8 + x^6 + 1$$

Verified against the standard test vector `"123456789"` yielding remainder `0xE3069283`.

---

## 2. FIX 4.4 Protocol Implementation

Fairlead implements an zero-allocation, token-based FIX 4.4 parser and serializer (`FIXParser.gs`, `FIXBuilder.gs`).

### Supported Messages

- **NewOrderSingle (`35=D`)**: Inbound order submissions.
- **OrderCancelRequest (`35=F`)**: Outbound cancellation requests.
- **ExecutionReport (`35=8`)**: Fills, partial fills, acknowledgments, and rejections.
- **Heartbeat (`35=0`)**: Session keep-alive ping.

### Tag Dictionary

| Tag | Field Name | Description |
|:---|:---|:---|
| `8` | `BeginString` | Protocol version (`FIX.4.4`) |
| `9` | `BodyLength` | Byte length from tag 35 to tag 10 |
| `35` | `MsgType` | Message type identifier |
| `49` | `SenderCompID` | Client trading firm identifier |
| `56` | `TargetCompID` | Routing gateway identifier (`FAIRLEAD`) |
| `34` | `MsgSeqNum` | Integer sequence counter |
| `52` | `SendingTime` | UTC timestamp in `YYYYMMDD-HH:MM:SS.sss` |
| `11` | `ClOrdID` | Unique client order reference |
| `41` | `OrigClOrdID` | Original client order reference for cancels |
| `55` | `Symbol` | Ticker symbol (e.g. `AAPL`, `MSFT`) |
| `54` | `Side` | `1`=Buy, `2`=Sell, `5`=Sell Short, `6`=Sell Short Exempt |
| `38` | `OrderQty` | Quantity requested in shares |
| `40` | `OrdType` | `1`=Market, `2`=Limit, `P`=Pegged Midpoint, `d`=Iceberg |
| `44` | `Price` | Limit price in US Dollars |
| `59` | `TimeInForce` | `0`=Day, `1`=GTC, `3`=IOC, `4`=FOK |
| `10` | `CheckSum` | Three-digit modulo 256 checksum |

### Checksum Computation

The FIX checksum is calculated by summing all byte values from the start of the message through the delimiter immediately preceding tag 10, modulo 256:

$$\text{CheckSum} = \left( \sum_{i=1}^{L} \text{byte}_i \right) \pmod{256}$$

Formatted as a three-character zero-padded decimal string (`String.format("%03d", sum)`).

---

## 3. NASDAQ TotalView-ITCH 5.0

ITCH is NASDAQ's direct order-book feed protocol. Fairlead parses both raw binary ITCH messages and simulated tick events.

### Message Formats

1. **System Event Message (`S`)**: Signals market state transitions (Start of Day `O`, Start of Regular Hours `Q`, End of Regular Hours `M`).
2. **Add Order Message (`A`)**:
   - `Type`: 1 byte (`'A'`)
   - `Locate`: 2 bytes
   - `Tracking`: 2 bytes
   - `Timestamp`: 6 bytes (nanoseconds since midnight)
   - `OrderReferenceNumber`: 8 bytes
   - `BuySellIndicator`: 1 byte (`'B'` or `'S'`)
   - `Shares`: 4 bytes
   - `Stock`: 8 bytes (padded with spaces)
   - `Price`: 4 bytes (fixed-point 4 decimals)
3. **Order Executed Message (`E`)**: Partially or fully fills an active resting order reference.
4. **Order Cancel Message (`X`)**: Reduces displayed shares of a resting order.
5. **Order Delete Message (`D`)**: Removes a resting order entirely from the book.

---

## 4. NASDAQ OUCH 4.2

OUCH is NASDAQ's direct, low-overhead native order entry protocol.

### Inbound & Outbound Formats

- **Enter Order (`O`)**:
  - `OrderToken`: 14 bytes ASCII
  - `BuySell`: 1 byte (`'B'` or `'S'`)
  - `Shares`: 4 bytes
  - `Stock`: 8 bytes
  - `Price`: 4 bytes (fixed-point $10000)
  - `TimeInForce`: 4 bytes
  - `Firm`: 4 bytes
  - `Display`: 1 byte (`'Y'` for display, `'N'` for non-display)
- **Order Accepted (`A`)**: Confirmation of accepted resting or executing order.
- **Order Executed (`E`)**: Direct execution notification.
- **Order Canceled (`C`)**: Order cancellation confirmation.
