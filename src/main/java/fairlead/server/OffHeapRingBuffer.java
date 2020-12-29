package fairlead.server;

import java.nio.ByteBuffer;
import java.util.concurrent.atomic.AtomicLong;

/**
 * High-performance lock-free off-heap circular ring buffer for microsecond market data event dispatching.
 * Uses power-of-two bitmask indexing and cache-line padded sequence counters to prevent CPU false sharing.
 */
public class OffHeapRingBuffer {
    private final int capacity;
    private final int mask;
    private final int slotSizeBytes;
    private final ByteBuffer offHeapStorage;

    // Cache-line padded head and tail sequence counters (64-byte spacing)
    protected long p01, p02, p03, p04, p05, p06, p07;
    private final AtomicLong head = new AtomicLong(0L);
    protected long p11, p12, p13, p14, p15, p16, p17;
    private final AtomicLong tail = new AtomicLong(0L);
    protected long p21, p22, p23, p24, p25, p26, p27;

    public OffHeapRingBuffer(int powerOfTwoCapacity, int slotSizeBytes) {
        if (Integer.bitCount(powerOfTwoCapacity) != 1) {
            throw new IllegalArgumentException("Capacity must be a power of two: " + powerOfTwoCapacity);
        }
        this.capacity = powerOfTwoCapacity;
        this.mask = powerOfTwoCapacity - 1;
        this.slotSizeBytes = slotSizeBytes;
        this.offHeapStorage = ByteBuffer.allocateDirect(capacity * slotSizeBytes);
    }

    public boolean offer(byte[] eventData) {
        if (eventData == null || eventData.length > slotSizeBytes) {
            return false;
        }

        long currentTail = tail.get();
        long currentHead = head.get();

        if (currentTail - currentHead >= capacity) {
            // Buffer full
            return false;
        }

        int slotIndex = (int) (currentTail & mask);
        int byteOffset = slotIndex * slotSizeBytes;

        offHeapStorage.position(byteOffset);
        offHeapStorage.putInt(eventData.length);
        offHeapStorage.put(eventData);

        tail.lazySet(currentTail + 1L);
        return true;
    }

    public byte[] poll() {
        long currentHead = head.get();
        long currentTail = tail.get();

        if (currentHead >= currentTail) {
            // Buffer empty
            return null;
        }

        int slotIndex = (int) (currentHead & mask);
        int byteOffset = slotIndex * slotSizeBytes;

        offHeapStorage.position(byteOffset);
        int len = offHeapStorage.getInt();
        byte[] data = new byte[len];
        offHeapStorage.get(data);

        head.lazySet(currentHead + 1L);
        return data;
    }

    public int getCapacity() { return capacity; }
    public long getOccupancy() { return tail.get() - head.get(); }
    public boolean isEmpty() { return head.get() == tail.get(); }
}
