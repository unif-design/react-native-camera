"""Fetch pinned coverage tools; respect HTTP(S)_PROXY and explicit local caches."""
import hashlib
import os
from pathlib import Path
import urllib.request

JACOCO_VERSION = "0.8.13"
JACOCO = {
    "jacocoagent.jar": ("org.jacoco.agent", "runtime", "47e700ccb0fdb9e27c5241353f8161938f4e53c3561dd35e063c5fe88dc3349b"),
    "jacococli.jar": ("org.jacoco.cli", "nodeps", "8f748683833d4dc4d72cea5d6b43f49344687b831e0582c97bcb9b984e3de0a3"),
}


def jacoco_tools(root):
    explicit = os.environ.get("JACOCO_HOME")
    directory = Path(explicit) if explicit else root / "node_modules/.cache/native-coverage/jacoco" / JACOCO_VERSION
    for filename, (artifact, classifier, expected) in JACOCO.items():
        path = directory / filename
        if not path.is_file():
            if explicit:
                raise RuntimeError("Missing explicitly configured coverage tool: " + str(path))
            url = ("https://repo.maven.apache.org/maven2/org/jacoco/" + artifact + "/" + JACOCO_VERSION
                   + "/" + artifact + "-" + JACOCO_VERSION + "-" + classifier + ".jar")
            with urllib.request.urlopen(url, timeout=60) as response:
                content = response.read()
            if hashlib.sha256(content).hexdigest() != expected:
                raise RuntimeError("Downloaded coverage tool checksum mismatch: " + url)
            directory.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError("Coverage tool checksum mismatch: " + str(path))
    return directory / "jacocoagent.jar", directory / "jacococli.jar"
