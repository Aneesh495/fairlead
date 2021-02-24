# Fairlead: High-Throughput Smart Order Router and Liquidity Aggregator
# Development, compilation, testing, and benchmark orchestration Makefile

SHELL := /bin/bash
JAVA ?= java
JAVAC ?= javac
CC ?= clang
PYTHON ?= python3

ROOT_DIR := $(shell pwd)
LIB_DIR := $(ROOT_DIR)/lib
LIBS_CP := $(LIB_DIR)/*

SRC_JAVA_DIR := $(ROOT_DIR)/src/main/java
SRC_GOSU_DIR := $(ROOT_DIR)/src/main/gosu
TEST_GOSU_DIR := $(ROOT_DIR)/src/test/gosu
TEST_JAVA_DIR := $(ROOT_DIR)/src/test/java

BUILD_DIR := $(ROOT_DIR)/build
BUILD_CLASSES_JAVA := $(BUILD_DIR)/classes/java
BUILD_CLASSES_TEST := $(BUILD_DIR)/classes/test

C_SRC_DIR := $(ROOT_DIR)/c_src

CLASSPATH := $(BUILD_CLASSES_JAVA):$(LIBS_CP)
GOSU_CP := $(SRC_GOSU_DIR):$(TEST_GOSU_DIR):$(CLASSPATH)

.PHONY: all clean compile-java compile-test-java test test-gosu test-native test-python native bench server cli tui verify help

all: compile-java native test

help:
	@echo "Fairlead Build Targets:"
	@echo "  make all          : Compile Java bridges, build native SIMD kernels, and run tests"
	@echo "  make compile-java : Compile high-throughput Java NIO and off-heap ring buffer"
	@echo "  make native       : Build C99 SIMD acceleration library (NEON/AVX2 CRC-32C)"
	@echo "  make test         : Execute comprehensive Gosu, C, and Python verification suites"
	@echo "  make test-gosu    : Execute Gosu order book, risk, SOR, and algo test suite"
	@echo "  make test-native  : Execute C native SIMD unit tests"
	@echo "  make bench        : Run high-throughput order routing and latency microbenchmarks"
	@echo "  make server       : Launch embedded Fairlead server (NIO, FIX, HTTP, WebSocket)"
	@echo "  make cli          : Launch interactive order submission and routing CLI"
	@echo "  make tui          : Launch real-time multi-venue market ladder terminal dashboard"
	@echo "  make verify       : Execute complete end-to-end repository integrity verification"
	@echo "  make clean        : Remove all compiled bytecode, binaries, and temporary state"

$(BUILD_CLASSES_JAVA):
	@mkdir -p $(BUILD_CLASSES_JAVA)

$(BUILD_CLASSES_TEST):
	@mkdir -p $(BUILD_CLASSES_TEST)

compile-java: $(BUILD_CLASSES_JAVA)
	@echo "==> Compiling Java NIO runtime bridge and off-heap memory structures..."
	@find $(SRC_JAVA_DIR) -name "*.java" > $(BUILD_DIR)/java_sources.txt 2>/dev/null || true
	@if [ -s $(BUILD_DIR)/java_sources.txt ]; then \
		$(JAVAC) -d $(BUILD_CLASSES_JAVA) -cp "$(LIBS_CP)" @$(BUILD_DIR)/java_sources.txt; \
	fi

compile-test-java: compile-java $(BUILD_CLASSES_TEST)
	@echo "==> Compiling Java test fixtures..."
	@find $(TEST_JAVA_DIR) -name "*.java" > $(BUILD_DIR)/test_java_sources.txt 2>/dev/null || true
	@if [ -s $(BUILD_DIR)/test_java_sources.txt ]; then \
		$(JAVAC) -d $(BUILD_CLASSES_TEST) -cp "$(CLASSPATH)" @$(BUILD_DIR)/test_java_sources.txt; \
	fi

native:
	@echo "==> Compiling C99 SIMD kernels and binary protocol parser..."
	@if [ -d "$(C_SRC_DIR)" ]; then \
		$(MAKE) -C $(C_SRC_DIR) all; \
	fi

test-native: native
	@echo "==> Running C99 SIMD test suite..."
	@if [ -d "$(C_SRC_DIR)" ]; then \
		$(MAKE) -C $(C_SRC_DIR) test; \
	fi

test-gosu: compile-java
	@echo "==> Executing Gosu unit, invariant, and regression test suites..."
	@$(JAVA) -cp "$(CLASSPATH)" gw.lang.Gosu -classpath "$(SRC_GOSU_DIR):$(TEST_GOSU_DIR):$(BUILD_CLASSES_JAVA)" -e "fairlead.test.TestRunner.main(new String[0])"

test-python:
	@echo "==> Executing Python client test suite..."
	@if [ -d "$(ROOT_DIR)/python/tests" ]; then \
		PYTHONPATH=$(ROOT_DIR)/python $(PYTHON) -m unittest discover -s $(ROOT_DIR)/python/tests -p "test_*.py"; \
	fi

test: test-gosu test-native test-python
	@echo "==> All test suites passed successfully."

bench: compile-java native
	@echo "==> Running microbenchmarks..."
	@bash $(ROOT_DIR)/benchmarks/microbench.sh

server: compile-java
	@echo "==> Launching Fairlead server daemon..."
	@$(JAVA) -cp "$(CLASSPATH)" gw.lang.Gosu -classpath "$(SRC_GOSU_DIR):$(BUILD_CLASSES_JAVA)" $(SRC_GOSU_DIR)/fairlead/Main.gs server

cli: compile-java
	@$(JAVA) -cp "$(CLASSPATH)" gw.lang.Gosu -classpath "$(SRC_GOSU_DIR):$(BUILD_CLASSES_JAVA)" $(SRC_GOSU_DIR)/fairlead/Main.gs cli

tui:
	@PYTHONPATH=$(ROOT_DIR)/python $(PYTHON) -m fairlead.tui

verify:
	@bash $(ROOT_DIR)/scripts/verify.sh

clean:
	@echo "==> Cleaning build artifacts and runtime state..."
	@rm -rf $(BUILD_DIR)
	@if [ -d "$(C_SRC_DIR)" ]; then \
		$(MAKE) -C $(C_SRC_DIR) clean 2>/dev/null || true; \
	fi
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf python/*.egg-info python/build python/dist
