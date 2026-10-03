import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cases = [
  [1920, 1080, '16:9', [0, 0, 1920, 1080]],
  [1920, 1440, '4:3', [0, 0, 1920, 1440]],
  [1080, 1920, '16:9', [0, 0, 1080, 1920]],
  [1440, 1920, '4:3', [0, 0, 1440, 1920]],
  [4000, 3000, '16:9', [0, 375, 4000, 2250]],
  [3000, 4000, '16:9', [375, 0, 2250, 4000]],
  [1920, 1080, '4:3', [240, 0, 1440, 1080]],
  [1080, 1920, '4:3', [0, 240, 1080, 1440]],
  [1000, 1000, '4:3', [125, 0, 750, 1000]],
];

// Compile the exact production functions; never keep a second crop implementation.
// A changed function boundary deliberately fails this test instead of using stale code.
function extract(source, pattern) {
  const matched = source.match(pattern);
  assert.ok(matched, `Production function missing: ${pattern}`);
  return matched[0];
}

function verify(output, origin = [0, 0]) {
  const rows = output.trim().split('\n');
  assert.equal(rows.length, cases.length);
  rows.forEach((row, index) => {
    const [width, height, ratio, expected] = cases[index];
    const actual = row.trim().split(/\s+/).map(Number);
    const shifted = [
      expected[0] + origin[0],
      expected[1] + origin[1],
      ...expected.slice(2),
    ];
    assert.deepEqual(actual, shifted, `${width}x${height}, ${ratio}`);
  });
}

function withTemporaryDirectory(run) {
  const directory = mkdtempSync(path.join(tmpdir(), 'unif-native-geometry-'));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test(
  'iOS production crop preserves landscape, portrait and nonzero extent origins',
  { skip: process.platform !== 'darwin' },
  () => {
    withTemporaryDirectory((directory) => {
      const source = readFileSync(
        path.join(root, 'ios/UnifPhotoProcessor.mm'),
        'utf8'
      );
      const crop = extract(source, /static CGRect UnifCropRect\([\s\S]*?\n\}/);
      const harness = path.join(directory, 'Crop.m');
      const binary = path.join(directory, 'crop');
      const statements = cases
        .map(
          ([width, height, ratio]) => `
      { CGRect r = UnifCropRect(CGRectMake(32, -16, ${width}, ${height}), @"${ratio}");
        printf("%.8f %.8f %.8f %.8f\\n", r.origin.x, r.origin.y, r.size.width, r.size.height); }
    `
        )
        .join('\n');
      writeFileSync(
        harness,
        `#import <Foundation/Foundation.h>\n#import <CoreGraphics/CoreGraphics.h>\n${crop}\nint main() { @autoreleasepool { ${statements} } }`
      );
      execFileSync('xcrun', [
        'clang',
        '-fobjc-arc',
        '-framework',
        'Foundation',
        '-framework',
        'CoreGraphics',
        harness,
        '-o',
        binary,
      ]);
      verify(execFileSync(binary, { encoding: 'utf8' }), [32, -16]);
    });
  }
);

function cachedJar(group, name, version) {
  const cache = path.join(
    process.env.GRADLE_USER_HOME ?? path.join(homedir(), '.gradle'),
    'caches/modules-2/files-2.1',
    group,
    name,
    version
  );
  assert.ok(
    existsSync(cache),
    `Missing ${name}:${version}. Resolve the existing Android Gradle dependencies before this test.`
  );
  for (const hash of readdirSync(cache)) {
    const jar = path.join(cache, hash, `${name}-${version}.jar`);
    if (existsSync(jar)) return jar;
  }
  assert.fail(`Cached jar missing: ${cache}`);
}

test('Android production crop preserves landscape, portrait and center crop', () => {
  withTemporaryDirectory((directory) => {
    const source = readFileSync(
      path.join(
        root,
        'android/src/main/java/com/unif/reactnativecamera/UnifPhotoProcessorModule.kt'
      ),
      'utf8'
    );
    const crop = extract(
      source,
      / {2}private fun computeCrop\([\s\S]*?\n {2}\}/
    );
    const rect = extract(
      source,
      / {2}private data class CropRect\([\s\S]*?\n {2}\)/
    );
    const harness = path.join(directory, 'Crop.kt');
    const binary = path.join(directory, 'crop.jar');
    const statements = cases
      .map(
        ([width, height, ratio]) =>
          `computeCrop(${width}, ${height}, "${ratio}").also { println("\${it.left} \${it.top} \${it.width} \${it.height}") }`
      )
      .join('\n');
    writeFileSync(harness, `${rect}\n${crop}\nfun main() { ${statements} }`);
    const version = readFileSync(
      path.join(root, 'android/build.gradle'),
      'utf8'
    ).match(/kotlinVersion: "([^"]+)"/)?.[1];
    assert.ok(version, 'Kotlin version missing');
    const stdlib = cachedJar('org.jetbrains.kotlin', 'kotlin-stdlib', version);
    const dependencies = [
      cachedJar('org.jetbrains.kotlin', 'kotlin-compiler-embeddable', version),
      stdlib,
      cachedJar('org.jetbrains.kotlin', 'kotlin-script-runtime', version),
      cachedJar('org.jetbrains.kotlin', 'kotlin-daemon-embeddable', version),
      cachedJar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
      cachedJar('org.jetbrains.intellij.deps', 'trove4j', '1.0.20200330'),
      cachedJar(
        'org.jetbrains.kotlinx',
        'kotlinx-coroutines-core-jvm',
        '1.8.0'
      ),
      cachedJar('org.jetbrains', 'annotations', '13.0'),
    ];
    const java = process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin/java')
      : 'java';
    execFileSync(java, [
      '-cp',
      dependencies.join(path.delimiter),
      'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
      '-no-stdlib',
      '-no-reflect',
      '-classpath',
      stdlib,
      harness,
      '-d',
      binary,
    ]);
    verify(
      execFileSync(
        java,
        ['-cp', [binary, stdlib].join(path.delimiter), 'CropKt'],
        { encoding: 'utf8' }
      )
    );
  });
});
