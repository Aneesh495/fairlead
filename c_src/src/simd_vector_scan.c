#include "fairlead_simd.h"

// Scans price and quantity vectors accumulating volume until price threshold is crossed
int64_t fairlead_vector_scan_volume(const int64_t *prices, const int64_t *quantities,
                                    size_t count, int64_t price_threshold, bool is_buy) {
    if (!prices || !quantities || count == 0) return 0;

    int64_t accumulated_volume = 0;

    if (is_buy) {
        // For a buyer lifting the ask ladder: ask_price <= price_threshold
        for (size_t i = 0; i < count; i++) {
            if (prices[i] <= price_threshold) {
                accumulated_volume += quantities[i];
            } else {
                break;
            }
        }
    } else {
        // For a seller hitting the bid ladder: bid_price >= price_threshold
        for (size_t i = 0; i < count; i++) {
            if (prices[i] >= price_threshold) {
                accumulated_volume += quantities[i];
            } else {
                break;
            }
        }
    }

    return accumulated_volume;
}
