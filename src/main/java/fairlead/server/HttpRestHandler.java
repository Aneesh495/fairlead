package fairlead.server;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.HashMap;

/**
 * Lightweight HTTP 1.1 REST request router and JSON response serializer.
 */
public class HttpRestHandler {
    public static class HttpResponse {
        public final int statusCode;
        public final String contentType;
        public final String body;

        public HttpResponse(int code, String type, String body) {
            this.statusCode = code;
            this.contentType = type;
            this.body = body;
        }

        public byte[] toBytes() {
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 " + statusCode + " " + getStatusText(statusCode) + "\r\n" +
                             "Content-Type: " + contentType + "\r\n" +
                             "Content-Length: " + bodyBytes.length + "\r\n" +
                             "Access-Control-Allow-Origin: *\r\n" +
                             "Connection: close\r\n\r\n";
            byte[] headerBytes = headers.getBytes(StandardCharsets.US_ASCII);
            byte[] out = new byte[headerBytes.length + bodyBytes.length];
            System.arraycopy(headerBytes, 0, out, 0, headerBytes.length);
            System.arraycopy(bodyBytes, 0, out, headerBytes.length, bodyBytes.length);
            return out;
        }

        private static String getStatusText(int code) {
            switch (code) {
                case 200: return "OK";
                case 201: return "Created";
                case 400: return "Bad Request";
                case 404: return "Not Found";
                case 500: return "Internal Server Error";
                default: return "OK";
            }
        }
    }

    public static HttpResponse handle(String method, String path, String body) {
        if ("GET".equalsIgnoreCase(method)) {
            if ("/api/v1/health".equals(path)) {
                return new HttpResponse(200, "application/json", "{\"status\":\"UP\",\"engine\":\"fairlead\",\"version\":\"0.1.0\"}");
            }
            if ("/api/v1/stats".equals(path)) {
                return new HttpResponse(200, "application/json", "{\"engine\":\"fairlead\",\"uptime_sec\":" + (System.currentTimeMillis()/1000) + ",\"status\":\"ACTIVE\"}");
            }
        }

        if ("POST".equalsIgnoreCase(method) && "/api/v1/orders".equals(path)) {
            return new HttpResponse(200, "application/json", "{\"status\":\"ACCEPTED\",\"route\":\"DEPTH_OF_BOOK_SWEEP\",\"slices\":2}");
        }

        return new HttpResponse(404, "application/json", "{\"error\":\"Not Found\",\"path\":\"" + path + "\"}");
    }
}
