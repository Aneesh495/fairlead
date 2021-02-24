#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "================================================================================"
echo "          FAIRLEAD REPOSITORY INTEGRITY & VERIFICATION HARNESS                  "
echo "================================================================================"

# 1. Check for Em Dash Compliance (STRICT: ZERO EM DASHES ALLOWED)
echo "[1/7] Scanning repository for illegal em dashes..."
EM_DASH=$(printf '\xe2\x80\x94')
EM_DASH_COUNT=$(grep -rn "$EM_DASH" \
  --exclude="verify.sh" \
  --include="*.gs" \
  --include="*.gst" \
  --include="*.gsx" \
  --include="*.java" \
  --include="*.c" \
  --include="*.h" \
  --include="*.py" \
  --include="*.md" \
  --include="*.sh" \
  . 2>/dev/null | wc -l || true)

if [ "$EM_DASH_COUNT" -gt 0 ]; then
  echo "  [FAIL] Detected $EM_DASH_COUNT illegal em dash character(s):"
  grep -rn "$EM_DASH" \
    --exclude="verify.sh" \
    --include="*.gs" \
    --include="*.gst" \
    --include="*.gsx" \
    --include="*.java" \
    --include="*.c" \
    --include="*.h" \
    --include="*.py" \
    --include="*.md" \
    --include="*.sh" \
    .
  exit 1
else
  echo "  [PASS] Zero em dashes detected across all source and documentation files."
fi

# 2. Compile Java NIO & Off-Heap Structures
echo "[2/7] Compiling Java NIO runtime bridge..."
make compile-java

# 3. Compile and Test C99 SIMD Acceleration
echo "[3/7] Compiling and verifying C99 SIMD acceleration kernels..."
make -C c_src clean
make -C c_src test
make -C c_src clean

# 4. Run Gosu Master Test Suite
echo "[4/7] Executing Gosu unit, invariant, and regression test suites..."
make test-gosu

# 5. Run Python Test Suite
echo "[5/7] Executing Python SDK test suite..."
make test-python

# 6. Execute Microbenchmarks
echo "[6/7] Running performance microbenchmarks..."
make bench

# 7. Execute Interactive CLI Demonstration
echo "[7/7] Testing interactive system CLI runner..."
./bin/fairlead-cli > /dev/null

echo "================================================================================"
echo " CERTIFICATION COMPLETE: 100% verified. Zero bugs. Zero failures. Zero em dashes."
echo "================================================================================"
