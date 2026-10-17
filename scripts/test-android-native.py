"""Run production Kotlin against narrow Android/RN/vendor boundary doubles.

Requires the example Android build's cached Kotlin compiler and JDK 17+.
These tests do not measure a camera, Android image codec, or device heap.
"""

import os
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from native.coverage_tools import jacoco_tools
from native.check_library_coverage import main as check_coverage

root = Path(__file__).resolve().parent.parent
cache = (
    Path(os.environ.get("GRADLE_USER_HOME", str(Path.home() / ".gradle")))
    / "caches/modules-2/files-2.1"
)


def cached(pattern):
    matches = sorted(cache.glob(pattern))
    if not matches:
        raise SystemExit(
            "Missing cached Kotlin compiler dependency: " + pattern
            + "; run bash .github/ci/android.sh first"
        )
    return str(matches[-1])


def dependencies(module):
    """Use the compiler's own POM instead of picking unrelated cached versions."""
    pom = ET.parse(cached(module + "/*/*.pom"))
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    return [
        "/".join(dependency.findtext("m:" + field, namespaces=namespace)
                 for field in ("groupId", "artifactId", "version"))
        for dependency in pom.findall("m:dependencies/m:dependency", namespace)
    ]


build = (root / "example/android/build.gradle").read_text()
configured = re.search(r'kotlinVersion\s*=\s*"([^"]+)"', build)
if not configured:
    raise SystemExit("Cannot locate the example's configured Kotlin version")
version = configured.group(1)
compiler = "org.jetbrains.kotlin/kotlin-compiler-embeddable/" + version
stdlib = "org.jetbrains.kotlin/kotlin-stdlib/" + version
modules = [compiler, *dependencies(compiler), *dependencies(stdlib)]
classpath = [cached(module + "/*/*.jar") for module in dict.fromkeys(modules)]
stdlib_jar = cached(stdlib + "/*/*.jar")
json_jar = cached("org.json/json/20180813/*/*.jar")
annotations = [cached(module + "/*/*.jar") for module in dependencies(stdlib)]
java = (
    str(Path(os.environ["JAVA_HOME"]) / "bin/java")
    if "JAVA_HOME" in os.environ else shutil.which("java")
)
if not java:
    raise SystemExit("JDK 17+ is required; set JAVA_HOME")
production = root / "android/src/main/java/com/unif/reactnativecamera"
sources = sorted(production.glob("*.kt"))
sources += sorted((root / "scripts/native-tests/android").glob("*.kt"))
coverage = root / "coverage/native/android"
coverage.mkdir(parents=True, exist_ok=True)
agent, cli = jacoco_tools(root)
with tempfile.TemporaryDirectory(prefix="camera-native-") as target:
    command = [
        java, "-cp", os.pathsep.join(classpath),
        "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
        "-nowarn", "-no-stdlib", "-no-reflect",
        "-classpath", os.pathsep.join([stdlib_jar, json_jar, *annotations]),
        "-d", target, *map(str, sources),
    ]
    subprocess.run(command, check=True)
    result = subprocess.run([
        java, "-javaagent:" + str(agent) + "=destfile=" + str(coverage / "jacoco.exec") + ",append=false",
        "-cp", os.pathsep.join([target, stdlib_jar, json_jar]), "HarnessKt",
    ])
    report_classes = Path(target) / "report-classes"
    report_classes.mkdir()
    class_root = Path(target) / "com/unif/reactnativecamera"
    for source in production.glob("*.kt"):
        for compiled in class_root.glob(source.stem + "*.class"):
            destination = report_classes / compiled.relative_to(target)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(compiled, destination)
    subprocess.run([
        java, "-jar", str(cli), "report", str(coverage / "jacoco.exec"),
        "--classfiles", str(report_classes), "--sourcefiles", str(production),
        "--xml", str(coverage / "coverage.xml"), "--html", str(coverage / "html"),
    ], check=True)
    # Optional independent measurement of Kotlin's duplicated finally probes.
    # Both collectors receive the same unchanged class files and run the same assertions.
    intellij = os.environ.get("INTELLIJ_COVERAGE_HOME")
    if intellij:
        intellij = Path(intellij)
        jars = {
            "intellij-coverage-agent-1.0.777.jar": "b8c4455cda170a2f946dcb755de3e2a76376e52cfb86c898c8de2582aa2bef11",
            "intellij-coverage-reporter-1.0.777.jar": "dbac92f2dbe507d066a70d703ba15937b344900018e15644edeefe8ca90735a8",
            "coverage-report-1.0.27.jar": "8a29a130ab4fa9a23fd390ff535afb52fb55e5f61448423c16472be88609c03a",
        }
        for name, digest in jars.items():
            if hashlib.sha256((intellij / name).read_bytes()).hexdigest() != digest:
                raise SystemExit("Coverage collector integrity mismatch: " + name)
        data = coverage / "camera.ic"
        data.unlink(missing_ok=True)
        configuration = Path(target) / "intellij.args"
        configuration.write_text(str(data) + "\nfalse\nfalse\nfalse\nfalse\ncom\\.unif\\.reactnativecamera\\..*\n")
        subprocess.run([java, "-javaagent:" + str(intellij / "intellij-coverage-agent-1.0.777.jar") + "=" + str(configuration),
                        "-cp", os.pathsep.join([target, stdlib_jar, json_jar]), "HarnessKt"], check=True)
        reporter_classpath = os.pathsep.join(str(intellij / name) for name in jars)
        javac = str(Path(java).with_name("javac"))
        subprocess.run([javac, "-cp", reporter_classpath, "-d", target,
                        str(root / "scripts/native-tests/android/reporting/CoverageReport.java")], check=True)
        subprocess.run([java, "-cp", target + os.pathsep + reporter_classpath, "CoverageReport",
                        str(coverage / "intellij-coverage.xml"), str(report_classes), str(production), str(data)], check=True)
        print("JetBrains independent counters (raw report retained):")
        for counter in ET.parse(coverage / "intellij-coverage.xml").getroot().findall("counter"):
            print(counter.attrib)
    if result.returncode:
        raise SystemExit(result.returncode)
    check_coverage("android")
