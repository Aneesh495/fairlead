#ifndef FAIRLEAD_SIMD_H
#define FAIRLEAD_SIMD_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Castagnoli CRC-32C polynomial (0x82F63B78)
uint32_t fairlead_crc32c(const uint8_t *data, size_t length);

// Vectorized book level scanning: locates the cumulative volume up to a price threshold
int64_t fairlead_vector_scan_volume(const int64_t *prices, const int64_t *quantities,
                                    size_t count, int64_t price_threshold, bool is_buy);

// Zero-copy binary NASDAQ ITCH 5.0 order add unpacker
#pragma pack(push, 1)
typedef struct {
    char message_type;
    uint16_t stock_locate;
    uint16_t tracking_number;
    uint8_t timestamp_bytes[6];
    uint64_t order_reference_number;
    char buy_sell_indicator;
    uint32_t shares;
    char stock[8];
    uint32_t price;
} fairlead_itch_add_order_t;
#pragma pack(pop)

bool fairlead_parse_itch_add_order(const uint8_t *buffer, size_t length, fairlead_itch_add_order_t *out);

#ifdef __cplusplus
}
#endif

#endif // FAIRLEAD_SIMD_H
