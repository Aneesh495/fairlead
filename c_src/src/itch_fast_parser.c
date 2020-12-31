#include "fairlead_simd.h"
#include <string.h>

bool fairlead_parse_itch_add_order(const uint8_t *buffer, size_t length, fairlead_itch_add_order_t *out) {
    if (!buffer || length < sizeof(fairlead_itch_add_order_t) || !out) {
        return false;
    }

    if (buffer[0] != 'A') {
        return false;
    }

    memcpy(out, buffer, sizeof(fairlead_itch_add_order_t));
    return true;
}
