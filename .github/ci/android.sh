#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
./example/android/gradlew -p example/android :unif_react-native-camera:compileDebugKotlin --console=plain --max-workers=2
python3 scripts/test-android-native.py
python3 scripts/native/check_example_android.py
