package fairlead.server;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.*;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Non-blocking Java NIO Selector server hosting high-throughput order entry,
 * HTTP REST telemetry, and real-time streaming WebSocket endpoints.
 */
public class FairleadServer implements Runnable {
    private final int port;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ServerSocketChannel serverChannel;
    private Selector selector;
    private final Map<SocketChannel, ConnectionSession> sessions = new ConcurrentHashMap<>();

    public FairleadServer(int port) {
        this.port = port;
    }

    public void start() throws IOException {
        selector = Selector.open();
        serverChannel = ServerSocketChannel.open();
        serverChannel.configureBlocking(false);
        serverChannel.bind(new InetSocketAddress(port));
        serverChannel.register(selector, SelectionKey.OP_ACCEPT);
        running.set(true);

        Thread thread = new Thread(this, "fairlead-nio-server");
        thread.setDaemon(true);
        thread.start();
        System.out.println("Fairlead NIO Server bound to port " + port);
    }

    public void stop() {
        running.set(false);
        if (selector != null) {
            selector.wakeup();
        }
        try {
            if (serverChannel != null) serverChannel.close();
        } catch (IOException ignored) {}
    }

    @Override
    public void run() {
        while (running.get()) {
            try {
                int selected = selector.select(500);
                if (selected == 0) continue;

                Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                while (it.hasNext()) {
                    SelectionKey key = it.next();
                    it.remove();

                    if (!key.isValid()) continue;

                    if (key.isAcceptable()) {
                        handleAccept(key);
                    } else if (key.isReadable()) {
                        handleRead(key);
                    }
                }
            } catch (Exception e) {
                if (running.get()) {
                    System.err.println("NIO Server event loop error: " + e.getMessage());
                }
            }
        }
    }

    private void handleAccept(SelectionKey key) throws IOException {
        ServerSocketChannel ssc = (ServerSocketChannel) key.channel();
        SocketChannel client = ssc.accept();
        if (client != null) {
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ);
            String id = "SESSION-" + client.getRemoteAddress().toString();
            sessions.put(client, new ConnectionSession(id, client));
        }
    }

    private void handleRead(SelectionKey key) {
        SocketChannel client = (SocketChannel) key.channel();
        ConnectionSession session = sessions.get(client);
        if (session == null) return;

        try {
            ByteBuffer buffer = session.getReadBuffer();
            buffer.clear();
            int bytesRead = client.read(buffer);

            if (bytesRead == -1) {
                // Client disconnected
                client.close();
                sessions.remove(client);
                return;
            }

            buffer.flip();
            session.recordMessageReceived();

            // Check if HTTP request
            byte[] bytes = new byte[buffer.remaining()];
            buffer.get(bytes);
            String reqStr = new String(bytes, StandardCharsets.UTF_8);

            if (reqStr.startsWith("GET ") || reqStr.startsWith("POST ")) {
                handleHttpRequest(client, reqStr);
            }
        } catch (IOException e) {
            try { client.close(); } catch (IOException ignored) {}
            sessions.remove(client);
        }
    }

    private void handleHttpRequest(SocketChannel client, String req) throws IOException {
        int firstLineEnd = req.indexOf("\r\n");
        if (firstLineEnd <= 0) return;

        String firstLine = req.substring(0, firstLineEnd);
        String[] parts = firstLine.split(" ");
        if (parts.length < 2) return;

        String method = parts[0];
        String path = parts[1];

        // Extract body if POST
        String body = "";
        int bodyStart = req.indexOf("\r\n\r\n");
        if (bodyStart > 0 && bodyStart + 4 < req.length()) {
            body = req.substring(bodyStart + 4);
        }

        HttpRestHandler.HttpResponse resp = HttpRestHandler.handle(method, path, body);
        ByteBuffer respBuf = ByteBuffer.wrap(resp.toBytes());
        while (respBuf.hasRemaining()) {
            client.write(respBuf);
        }
    }

    public static void main(String[] args) throws Exception {
        int p = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        FairleadServer s = new FairleadServer(p);
        s.start();
        System.out.println("Fairlead daemon running. Press CTRL+C to terminate.");
        Thread.sleep(Long.MAX_VALUE);
    }
}
