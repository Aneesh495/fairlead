#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "fairlead_simd.h"

static void test_crc32c(void) {
    const uint8_t test_data[] = "123456789";
    // Canonical Castagnoli CRC-32C for "123456789" is 0xE3069283
    uint32_t crc = fairlead_crc32c(test_data, 9);
    assert(crc == 0xE3069283);
    printf("  [PASS] test_crc32c (0x%08X)\n", crc);
}

static void test_vector_scan(void) {
    int64_t ask_prices[] = {1000000, 1000100, 1000200, 1000500};
    int64_t ask_sizes[]  = {500,     800,     1200,    2000};

    // Buyer sweeping up to 100.02 (1000200) -> 500 + 800 + 1200 = 2500
    int64_t vol = fairlead_vector_scan_volume(ask_prices, ask_sizes, 4, 1000200, true);
    assert(vol == 2500);
    printf("  [PASS] test_vector_scan (accumulated volume %lld)\n", (long long)vol);
}

static void test_itch_fast_parse(void) {
    uint8_t packet[36];
    memset(packet, 0, sizeof(packet));
    packet[0] = 'A';
    packet[19] = 'B'; // Buy
    memcpy(&packet[24], "AAPL    ", 8);

    fairlead_itch_add_order_t out;
    bool success = fairlead_parse_itch_add_order(packet, sizeof(packet), &out);
    assert(success);
    assert(out.message_type == 'A');
    assert(out.buy_sell_indicator == 'B');
    printf("  [PASS] test_itch_fast_parse\n");
}

int main(void) {
    printf("Running Fairlead C99 SIMD unit test suite:\n");
    test_crc32c();
    test_vector_scan();
    test_itch_fast_parse();
    printf("All C99 SIMD tests passed successfully.\n");
    return 0;
}
