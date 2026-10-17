"""Check the full production inventory and all emitted native coverage metrics."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


def main(platform):
    output = ROOT / "coverage/native" / platform
    if platform == "android":
        base = ROOT / "android/src/main/java"
        sources = sorted(base.rglob("*.kt"))
        tree = ET.parse(output / "coverage.xml").getroot()
        observed = {package.attrib["name"] + "/" + source.attrib["name"]
                    for package in tree.findall("package") for source in package.findall("sourcefile")}
        expected = {str(source.relative_to(base)) for source in sources}
        metrics = {item.attrib["type"]: {key: int(item.attrib[key]) for key in ("covered", "missed")}
                   for item in tree.findall("counter")}
    else:
        sources = sorted(path for path in (ROOT / "ios").rglob("*") if path.suffix in (".m", ".mm"))
        data = json.loads((output / "coverage.json").read_text())["data"][0]
        observed = {item["filename"] for item in data["files"]}
        expected = set(map(str, sources))
        metrics = {key: {"covered": item["covered"], "missed": item["count"] - item["covered"]}
                   for key, item in data["totals"].items() if key in ("lines", "functions", "regions", "branches")}
    if not sources or observed != expected:
        raise RuntimeError("Native production source inventory mismatch: " + str(observed ^ expected))
    digests = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources}
    if platform == "ios":
        if json.loads((output / "sources-before.json").read_text()) != digests:
            raise RuntimeError("Production source changed during native instrumentation")
        mapping = [{"filename": item["filename"], "branches": item["branches"], "expansions": item["expansions"]} for item in data["files"]]
        (output / "branch-mapping.json").write_text(json.dumps(mapping, indent=2) + "\n")
    manifest = {"sources": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sources},
                "metrics": metrics, "collector": "JaCoCo 0.8.13" if platform == "android" else "Apple LLVM source coverage",
                "boundaries": "Real owned implementation; Android/UIKit/RN/vendor SDK boundaries are controlled. Device SDK behavior, recognition quality and hardware performance require separate acceptance."}
    (output / "scope.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for kind, item in metrics.items():
        print(kind, str(item["covered"]) + "/" + str(item["covered"] + item["missed"]))
    if not metrics or any(item["missed"] for item in metrics.values()):
        raise SystemExit("Native coverage has not reached 100%")


if __name__ == "__main__":
    main(sys.argv[1])
