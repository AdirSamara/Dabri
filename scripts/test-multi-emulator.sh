#!/bin/bash
# Multi-emulator test runner for Dabri
# Runs core Maestro flows + API-specific flows on each emulator

set -e

EMULATORS=("Pixel_4_API_30" "Pixel_6_API_33" "Pixel_7_API_34" "Pixel_8_API_35" "Pixel_9_API_36")
APK_PATH="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
RESULTS_DIR="e2e/results"
FAILED=0

mkdir -p "$RESULTS_DIR"

for EMU in "${EMULATORS[@]}"; do
  API_LEVEL=$(echo "$EMU" | grep -oE '[0-9]+$')
  echo ""
  echo "============================================"
  echo "  Testing on $EMU (API $API_LEVEL)"
  echo "============================================"

  # Boot emulator
  echo "Booting emulator..."
  emulator -avd "$EMU" -no-window -no-audio -gpu swiftshader_indirect &
  EMU_PID=$!
  adb wait-for-device
  adb shell input keyevent 82  # Unlock screen

  # Install APK
  echo "Installing APK..."
  adb install -r "$APK_PATH" || true

  # Core flows (run on ALL emulators)
  echo "Running core flows..."
  maestro test e2e/maestro/flows/ --format junit --output "$RESULTS_DIR/${EMU}_core.xml" || FAILED=1

  # API-specific flows (conditional)
  if [ "$API_LEVEL" -ge 33 ]; then
    echo "Running API 33+ flows..."
    maestro test e2e/maestro/flows-api33/ --format junit --output "$RESULTS_DIR/${EMU}_api33.xml" || FAILED=1
  fi

  if [ "$API_LEVEL" -ge 34 ]; then
    echo "Running API 34+ flows..."
    maestro test e2e/maestro/flows-api34/ --format junit --output "$RESULTS_DIR/${EMU}_api34.xml" || FAILED=1
  fi

  if [ "$API_LEVEL" -ge 35 ]; then
    echo "Running API 35+ flows..."
    maestro test e2e/maestro/flows-api35/ --format junit --output "$RESULTS_DIR/${EMU}_api35.xml" || FAILED=1
  fi

  if [ "$API_LEVEL" -ge 36 ]; then
    echo "Running API 36 flows..."
    maestro test e2e/maestro/flows-api36/ --format junit --output "$RESULTS_DIR/${EMU}_api36.xml" || FAILED=1
  fi

  # Kill emulator
  echo "Shutting down emulator..."
  adb emu kill 2>/dev/null || kill $EMU_PID 2>/dev/null || true
  sleep 2
done

echo ""
echo "============================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL EMULATORS PASSED"
else
  echo "  SOME TESTS FAILED — check $RESULTS_DIR/"
fi
echo "============================================"

exit $FAILED
