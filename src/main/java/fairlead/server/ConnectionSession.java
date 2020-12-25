package fairlead.server;

import java.nio.channels.SocketChannel;
import java.nio.ByteBuffer;

/**
 * Client connection session tracking socket channel state, authentication,
 * and pending read/write buffers.
 */
public class ConnectionSession {
    private final String sessionId;
    private final SocketChannel channel;
    private final ByteBuffer readBuffer;
    private final ByteBuffer writeBuffer;
    private long lastHeartbeatNs;
    private long messagesReceived;
    private long messagesSent;

    public ConnectionSession(String id, SocketChannel chan) {
        this.sessionId = id;
        this.channel = chan;
        this.readBuffer = ByteBuffer.allocateDirect(65536); // 64 KB off-heap direct buffer
        this.writeBuffer = ByteBuffer.allocateDirect(65536);
        this.lastHeartbeatNs = System.nanoTime();
        this.messagesReceived = 0L;
        this.messagesSent = 0L;
    }

    public String getSessionId() { return sessionId; }
    public SocketChannel getChannel() { return channel; }
    public ByteBuffer getReadBuffer() { return readBuffer; }
    public ByteBuffer getWriteBuffer() { return writeBuffer; }
    public long getLastHeartbeatNs() { return lastHeartbeatNs; }
    public long getMessagesReceived() { return messagesReceived; }
    public long getMessagesSent() { return messagesSent; }

    public void recordMessageReceived() {
        this.messagesReceived++;
        this.lastHeartbeatNs = System.nanoTime();
    }

    public void recordMessageSent() {
        this.messagesSent++;
    }
}
