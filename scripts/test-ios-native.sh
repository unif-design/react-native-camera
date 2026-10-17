#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/coverage/native/ios"
mkdir -p "$OUTPUT"
python3 - "$ROOT" "$OUTPUT" <<'PYTHON'
import hashlib, json, pathlib, sys
root, output = map(pathlib.Path, sys.argv[1:])
sources = sorted(path for path in (root / 'ios').rglob('*') if path.suffix in ('.m', '.mm'))
(output / 'sources-before.json').write_text(json.dumps({str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources}, indent=2) + '\n')
PYTHON
xcrun clang++ -std=c++20 -fobjc-arc -fblocks -fprofile-instr-generate -fcoverage-mapping \
  -DUNIF_CAMERA_TEST_BOUNDARIES -include "$ROOT/scripts/native-tests/ios/AppleBoundary.h" \
  -I"$ROOT/scripts/native-tests/ios" -I"$ROOT/ios" \
  -c "$ROOT/ios/UnifPhotoProcessor.mm" -o "$OUTPUT/UnifPhotoProcessor.o"
xcrun clang++ -std=c++20 -fobjc-arc -fblocks -fprofile-instr-generate -fcoverage-mapping \
  -framework Foundation -framework AVFoundation -framework CoreGraphics \
  -framework CoreImage -framework CoreText -framework ImageIO -framework CoreMedia \
  -I"$ROOT/scripts/native-tests/ios" -I"$ROOT/ios" \
  "$OUTPUT/UnifPhotoProcessor.o" "$ROOT/scripts/native-tests/ios/AppleBoundary.mm" \
  "$ROOT/scripts/native-tests/ios/Harness.mm" -o "$OUTPUT/camera-tests"
# Keep Apple's actual logging/signpost macros. Their enabled/disabled branches
# are exercised in separate processes without modifying global logging settings.
env -u OS_ACTIVITY_MODE LLVM_PROFILE_FILE="$OUTPUT/camera-tests.profraw" "$OUTPUT/camera-tests"
OS_ACTIVITY_MODE=disable LLVM_PROFILE_FILE="$OUTPUT/camera-logging-disabled.profraw" "$OUTPUT/camera-tests"
xcrun llvm-profdata merge -sparse "$OUTPUT/camera-tests.profraw" -o "$OUTPUT/camera-default.profdata"
xcrun llvm-cov export "$OUTPUT/camera-tests" -instr-profile="$OUTPUT/camera-default.profdata" "$ROOT"/ios/*.mm > "$OUTPUT/coverage-default.json"
xcrun llvm-profdata merge -sparse "$OUTPUT/camera-logging-disabled.profraw" -o "$OUTPUT/camera-logging-disabled.profdata"
xcrun llvm-cov export "$OUTPUT/camera-tests" -instr-profile="$OUTPUT/camera-logging-disabled.profdata" "$ROOT"/ios/*.mm > "$OUTPUT/coverage-logging-disabled.json"
xcrun llvm-profdata merge -sparse "$OUTPUT/camera-tests.profraw" "$OUTPUT/camera-logging-disabled.profraw" -o "$OUTPUT/camera-tests.profdata"
xcrun llvm-cov report "$OUTPUT/camera-tests" -instr-profile="$OUTPUT/camera-tests.profdata" "$ROOT"/ios/*.mm
xcrun llvm-cov export "$OUTPUT/camera-tests" -instr-profile="$OUTPUT/camera-tests.profdata" "$ROOT"/ios/*.mm > "$OUTPUT/coverage.json"
xcrun llvm-cov show "$OUTPUT/camera-tests" -instr-profile="$OUTPUT/camera-tests.profdata" \
  -format=html -output-dir="$OUTPUT/html" "$ROOT"/ios/*.mm

python3 "$ROOT/scripts/native/check_library_coverage.py" ios
