package fairlead.server;

import java.nio.ByteBuffer;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Off-heap direct memory slab pool allocating pre-sized byte buffers
 * with zero garbage collection overhead during high-frequency quotation bursts.
 */
public class UnsafeMemoryPool {
    private final int slabSizeBytes;
    private final int maxPoolCapacity;
    private final ConcurrentLinkedQueue<ByteBuffer> freePool;

    public UnsafeMemoryPool(int slabSizeBytes, int initialSlabs, int maxSlabs) {
        this.slabSizeBytes = slabSizeBytes;
        this.maxPoolCapacity = maxSlabs;
        this.freePool = new ConcurrentLinkedQueue<>();

        for (int i = 0; i < initialSlabs; i++) {
            freePool.offer(ByteBuffer.allocateDirect(slabSizeBytes));
        }
    }

    public ByteBuffer acquire() {
        ByteBuffer buf = freePool.poll();
        if (buf == null) {
            return ByteBuffer.allocateDirect(slabSizeBytes);
        }
        buf.clear();
        return buf;
    }

    public void release(ByteBuffer buf) {
        if (buf != null && buf.capacity() == slabSizeBytes) {
            if (freePool.size() < maxPoolCapacity) {
                buf.clear();
                freePool.offer(buf);
            }
        }
    }

    public int getAvailableSlabs() {
        return freePool.size();
    }
}
