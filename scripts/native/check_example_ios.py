"""Execute original Camera example Swift sources using external UIKit/RN doubles.

Foundation and bundle lookup are real. This measures owned host logic separately
from SDK behavior, signed builds, and device acceptance.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "__tests__/native-example/ios/swift"
SOURCES = ROOT / "example/ios/ReactNativeCameraExample"
OUTPUT = ROOT / "coverage/native/example-ios"


def run(*args, **kwargs):
    return subprocess.run(list(map(str, args)), check=True, **kwargs)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = sorted(path for path in SOURCES.rglob("*") if path.suffix in (".m", ".mm", ".swift"))
    reports = []
    with tempfile.TemporaryDirectory(prefix="camera-ios-native-") as directory:
        build = Path(directory)
        common = ["xcrun", "swiftc", "-swift-version", "5", "-I", build, "-L", build,
                  "-module-cache-path", build / "swift-cache"]
        linked = []
        for module in ("UIKit", "React", "React_RCTAppDelegate", "ReactAppDependencyProvider"):
            run(*common, "-emit-library", "-emit-module", "-module-name", module,
                "-emit-module-path", build / (module + ".swiftmodule"), TESTS / (module + ".swift"),
                *linked, "-Xlinker", "-undefined", "-Xlinker", "dynamic_lookup", "-o", build / ("lib" + module + ".dylib"))
            linked.append("-l" + module)
        for variant, flags in [("debug", ["-D", "DEBUG"]), ("release", [])]:
            executable = build / variant
            run(*common, "-profile-generate", "-profile-coverage-mapping", *flags,
                "-module-name", "CameraNativeTests", *sources, TESTS / "AppDelegateTests.swift",
                *linked, "-Xlinker", "-rpath", "-Xlinker", build, "-o", executable)
            profile = build / (variant + ".profraw")
            run(executable, env=dict(os.environ, LLVM_PROFILE_FILE=str(profile)), timeout=15)
            merged = build / (variant + ".profdata")
            run("xcrun", "llvm-profdata", "merge", "-sparse", profile, "-o", merged)
            arguments = [str(executable), "-instr-profile=" + str(merged), *map(str, sources)]
            result = run("xcrun", "llvm-cov", "export", *arguments, capture_output=True, text=True)
            data = json.loads(result.stdout)
            (OUTPUT / (variant + ".json")).write_text(json.dumps(data))
            run("xcrun", "llvm-cov", "report", *arguments)
            run("xcrun", "llvm-cov", "show", *arguments, "-format=html", "-output-dir=" + str(OUTPUT / variant))
            files = {item["filename"]: item["summary"] for item in data["data"][0]["files"]}
            if set(files) != set(map(str, sources)):
                raise RuntimeError("Swift coverage source inventory mismatch")
            reports.append({"variant": variant, "files": files})
            for filename, metrics in files.items():
                for metric in ("lines", "functions", "regions", "branches"):
                    if metrics[metric]["covered"] != metrics[metric]["count"]:
                        raise RuntimeError("Swift coverage below 100%: " + filename + " " + metric)
    manifest = {"sources": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources},
                "reports": reports,
                "swiftBranches": "N/A: this Swift compiler does not emit branch counters. Both scene types and DEBUG/RELEASE paths execute.",
                "boundaries": "UIKit and React Native are controlled external doubles; Foundation is real. Native library implementations: none. Device behavior remains a separate gate."}
    (OUTPUT / "scope.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
