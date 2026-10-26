"""Execute original example Kotlin sources; Android and RN are external doubles.

Requires JDK 17+, the example's Kotlin compiler in Gradle cache, and JaCoCo
0.8.13. Source inventory is verified; no owned classes are removed from counters.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from coverage_tools import jacoco_tools

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "example/android/__tests__"
SOURCES = ROOT / "example/android/app/src/main/java"
OUTPUT = ROOT / "coverage/native/example-android"
CACHE = Path(os.environ.get("GRADLE_USER_HOME", str(Path.home() / ".gradle"))) / "caches/modules-2/files-2.1"


def cached(pattern):
    matches = sorted(CACHE.glob(pattern))
    if not matches:
        raise SystemExit("Missing installed Gradle dependency: " + pattern)
    return matches[-1]


def dependencies(module):
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    pom = ET.parse(cached(module + "/*/*.pom"))
    return ["/".join(item.findtext("m:" + field, namespaces=namespace)
                     for field in ("groupId", "artifactId", "version"))
            for item in pom.findall("m:dependencies/m:dependency", namespace)]


def run(*args, **kwargs):
    return subprocess.run(list(map(str, args)), check=True, **kwargs)


def main():
    version = re.search(r'kotlinVersion\s*=\s*"([^"]+)"', (ROOT / "example/android/build.gradle").read_text()).group(1)
    compiler = "org.jetbrains.kotlin/kotlin-compiler-embeddable/" + version
    stdlib = "org.jetbrains.kotlin/kotlin-stdlib/" + version
    compiler_modules = [compiler, *dependencies(compiler), *dependencies(stdlib)]
    compiler_classpath = os.pathsep.join(str(cached(module + "/*/*.jar")) for module in dict.fromkeys(compiler_modules))
    runtime = [cached(stdlib + "/*/*.jar"), *[cached(module + "/*/*.jar") for module in dependencies(stdlib)]]
    classpath = os.pathsep.join(map(str, runtime))
    java_home = Path(os.environ["JAVA_HOME"]) if "JAVA_HOME" in os.environ else None
    java = java_home / "bin/java" if java_home else shutil.which("java")
    javac = java_home / "bin/javac" if java_home else shutil.which("javac")
    if not java or not javac:
        raise SystemExit("JDK 17+ is required; set JAVA_HOME")
    agent, cli = jacoco_tools(ROOT)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    production = sorted(SOURCES.rglob("*.kt"))
    if not production:
        raise SystemExit("No example Kotlin sources found")
    with tempfile.TemporaryDirectory(prefix="camera-android-native-") as directory:
        build = Path(directory)
        java_tests = sorted(TESTS.glob("*.java"))
        run(java, "-cp", compiler_classpath, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
            "-no-stdlib", "-no-reflect", "-classpath", classpath, "-d", build,
            *production, *sorted(TESTS.glob("*.kt")), *java_tests)
        run(javac, "-cp", str(build) + os.pathsep + classpath, "-d", build, *java_tests)
        run(java, "-javaagent:" + str(agent) + "=destfile=" + str(OUTPUT / "host.exec") + ",append=false",
            "-cp", str(build) + os.pathsep + classpath, "HarnessKt", timeout=30)
        classes = build / "report-classes"
        classes.mkdir()
        for source in production:
            package = re.search(r"^package ([\w.]+)", source.read_text(), re.M).group(1)
            for compiled in (build / package.replace(".", "/")).glob(source.stem + "*.class"):
                destination = classes / compiled.relative_to(build)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(compiled, destination)
        run(java, "-jar", cli, "report", OUTPUT / "host.exec", "--classfiles", classes,
            "--sourcefiles", SOURCES, "--xml", OUTPUT / "coverage.xml", "--html", OUTPUT / "html")
    tree = ET.parse(OUTPUT / "coverage.xml")
    observed = {node.attrib["name"] + "/" + item.attrib["name"]
                for node in tree.getroot().findall("package") for item in node.findall("sourcefile")}
    expected = {str(source.relative_to(SOURCES)) for source in production}
    if observed != expected:
        raise RuntimeError("Coverage source inventory mismatch: " + str(observed ^ expected))
    counters = {counter.attrib["type"]: {key: int(counter.attrib[key]) for key in ("covered", "missed")}
                for counter in tree.getroot().findall("counter")}
    manifest = {"sources": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in production},
                "runtime": {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in runtime},
                "counters": counters, "collector": "JaCoCo 0.8.13",
                "collectorArtifacts": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in [agent, cli]},
                "boundaries": "Android and RN interfaces are external host doubles. Native library implementations: none. APK build and device acceptance are separate."}
    (OUTPUT / "scope.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for kind, counter in counters.items():
        print(kind, str(counter["covered"]) + "/" + str(counter["covered"] + counter["missed"]))
    if any(counter["missed"] for counter in counters.values()):
        raise SystemExit("Example Kotlin coverage has not reached 100%")


if __name__ == "__main__":
    main()
