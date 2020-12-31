CC ?= clang
CFLAGS ?= -O3 -Wall -Wextra -std=c99 -fPIC -Iinclude

SRC := src/crc32c.c src/simd_vector_scan.c src/itch_fast_parser.c
OBJS := $(SRC:.c=.o)
TEST_SRC := test/test_simd.c
TEST_BIN := test_simd
LIB := libfairlead_simd.a

.PHONY: all test clean

all: $(LIB) $(TEST_BIN)

$(LIB): $(OBJS)
	ar rcs $@ $^

src/%.o: src/%.c
	$(CC) $(CFLAGS) -c $< -o $@

$(TEST_BIN): $(TEST_SRC) $(LIB)
	$(CC) $(CFLAGS) $< $(LIB) -o $@

test: $(TEST_BIN)
	./$(TEST_BIN)

clean:
	rm -f src/*.o $(LIB) $(TEST_BIN)
