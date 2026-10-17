#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bash scripts/test-ios-native.sh
python3 scripts/native/check_example_ios.py
