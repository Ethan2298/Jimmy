#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
NATIVE_DIR="$ROOT_DIR/native/keystroke-watcher"
BIN_DIR="$ROOT_DIR/native/bin"

mkdir -p "$BIN_DIR"

echo "Building keystroke-watcher..."
cd "$NATIVE_DIR"
swift build -c release 2>&1

# Copy binary to bin directory
BUILD_BIN=$(swift build -c release --show-bin-path)/keystroke-watcher
cp "$BUILD_BIN" "$BIN_DIR/keystroke-watcher"

echo "Built: $BIN_DIR/keystroke-watcher"
