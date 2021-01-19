#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$ROOT_DIR/lib"
SRC_GOSU="$ROOT_DIR/src/main/gosu"
BENCH_GOSU="$ROOT_DIR/benchmarks/gosu"
CLASSES="$ROOT_DIR/build/classes/java"

echo "==> Executing Fairlead High-Throughput Benchmarks..."
java -cp "$CLASSES:$LIB_DIR/*" gw.lang.Gosu -classpath "$SRC_GOSU:$BENCH_GOSU:$CLASSES" -e "fairlead.bench.BenchRunner.main(new String[]{\"50000\"})"
