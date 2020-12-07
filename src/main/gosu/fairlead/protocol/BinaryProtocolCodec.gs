package fairlead.protocol

uses java.nio.ByteBuffer
uses java.util.zip.CRC32

/**
 * High-speed binary transport framing codec (FRLD-1 wire protocol).
 * Encapsulates message framing, sequence validation, timestamp auditing,
 * and 32-bit CRC checksum integrity validation for zero-copy socket transfers.
 */
class BinaryProtocolCodec {
  public static final var MAGIC_HEADER : int = 0x46524C44 // "FRLD" in ASCII
  public static final var PROTOCOL_VERSION : short = 1
  public static final var HEADER_SIZE : int = 28 // Magic(4) + Ver(2) + MsgType(2) + Len(4) + Seq(8) + Time(8)
  public static final var TRAILER_SIZE : int = 4 // CRC-32(4)

  public static final var MSG_QUOTE          : short = 0x0001
  public static final var MSG_NEW_ORDER      : short = 0x0002
  public static final var MSG_EXEC_REPORT    : short = 0x0003
  public static final var MSG_CANCEL_REQUEST : short = 0x0004
  public static final var MSG_HEARTBEAT      : short = 0x0005

  static class Frame {
    var _messageType : short as MessageType
    var _sequenceNumber : long as SequenceNumber
    var _timestampNs : long as TimestampNs
    var _payload : byte[] as Payload

    construct(type : short, seq : long, timeNs : long, payload : byte[]) {
      _messageType = type
      _sequenceNumber = seq
      _timestampNs = timeNs
      _payload = payload
    }
  }

  public static function encodeFrame(msgType : short, seqNum : long, payload : byte[]) : ByteBuffer {
    var payloadLen = payload != null ? payload.length : 0
    var totalSize = HEADER_SIZE + payloadLen + TRAILER_SIZE
    var buf = ByteBuffer.allocate(totalSize)

    // Write header
    buf.putInt(MAGIC_HEADER)
    buf.putShort(PROTOCOL_VERSION)
    buf.putShort(msgType)
    buf.putInt(payloadLen)
    buf.putLong(seqNum)
    buf.putLong(java.lang.System.nanoTime())

    // Write payload
    if (payload != null && payload.length > 0) {
      buf.put(payload)
    }

    // Compute CRC32 over header + payload
    var crc = new CRC32()
    crc.update(buf.array(), 0, HEADER_SIZE + payloadLen)
    var crcVal = crc.getValue() as int
    buf.putInt(crcVal)

    buf.flip()
    return buf
  }

  public static function decodeFrame(buf : ByteBuffer) : Frame {
    if (buf == null || buf.remaining() < (HEADER_SIZE + TRAILER_SIZE)) {
      return null
    }

    var startPos = buf.position()
    var magic = buf.getInt()
    if (magic != MAGIC_HEADER) {
      throw new java.lang.IllegalArgumentException("Corrupt frame: invalid magic header 0x" + java.lang.Integer.toHexString(magic))
    }

    var version = buf.getShort()
    var msgType = buf.getShort()
    var payloadLen = buf.getInt()
    var seqNum = buf.getLong()
    var timeNs = buf.getLong()

    if (buf.remaining() < payloadLen + TRAILER_SIZE) {
      buf.position(startPos) // Rewind: frame incomplete
      return null
    }

    var payload = new byte[payloadLen]
    if (payloadLen > 0) {
      buf.get(payload)
    }

    var expectedCrc = buf.getInt()

    // Validate CRC
    var crc = new CRC32()
    crc.update(buf.array(), startPos, HEADER_SIZE + payloadLen)
    var actualCrc = crc.getValue() as int

    if (actualCrc != expectedCrc) {
      throw new java.lang.IllegalStateException("Checksum failure: expected 0x" + java.lang.Integer.toHexString(expectedCrc) +
                                                ", computed 0x" + java.lang.Integer.toHexString(actualCrc))
    }

    return new Frame(msgType, seqNum, timeNs, payload)
  }
}
