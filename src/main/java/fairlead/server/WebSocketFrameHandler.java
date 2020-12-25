package fairlead.server;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * RFC 6455 WebSocket handshaker and framing codec for real-time market data broadcasting.
 */
public class WebSocketFrameHandler {
    private static final String WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    public static String createHandshakeResponse(String clientKey) {
        try {
            String acceptSeed = clientKey.trim() + WS_MAGIC_GUID;
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] hash = sha1.digest(acceptSeed.getBytes(StandardCharsets.US_ASCII));
            String acceptKey = Base64.getEncoder().encodeToString(hash);

            return "HTTP/1.1 101 Switching Protocols\r\n" +
                   "Upgrade: websocket\r\n" +
                   "Connection: Upgrade\r\n" +
                   "Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n";
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate websocket handshake response", e);
        }
    }

    public static byte[] encodeTextFrame(String text) {
        byte[] payload = text.getBytes(StandardCharsets.UTF_8);
        int len = payload.length;

        ByteBuffer buf;
        if (len <= 125) {
            buf = ByteBuffer.allocate(2 + len);
            buf.put((byte) 0x81); // FIN + Text opcode (1)
            buf.put((byte) len);
        } else if (len <= 65535) {
            buf = ByteBuffer.allocate(4 + len);
            buf.put((byte) 0x81);
            buf.put((byte) 126);
            buf.putShort((short) len);
        } else {
            buf = ByteBuffer.allocate(10 + len);
            buf.put((byte) 0x81);
            buf.put((byte) 127);
            buf.putLong((long) len);
        }

        buf.put(payload);
        return buf.array();
    }
}
