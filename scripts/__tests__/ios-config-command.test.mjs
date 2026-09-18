import process from 'node:process';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
test('Podfile CLI config passes its directory as data without String.to_json', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'unif-ios-cli-'));
  try {
    const directory = path.join(fixture, 'app "quoted" path', 'ios');
    const moduleDirectory = path.join(
      directory,
      'node_modules/@react-native-community/cli'
    );
    mkdirSync(moduleDirectory, { recursive: true });
    writeFileSync(
      path.join(moduleDirectory, 'index.js'),
      'exports.run = () => process.stdout.write(JSON.stringify({ cwd: process.cwd(), argv: process.argv }));'
    );
    const ruby = spawnSync(
      'ruby',
      [
        '-rjson',
        '-e',
        `
      class String
        def to_json(*)
          raise 'legacy String.to_json must not be used for CLI arguments'
        end
      end
      source = File.read(ARGV[0])
      command = source.match(/config = use_native_modules!\\((\\[[\\s\\S]*?\\n\\s*\\])\\)/)
      raise 'missing explicit CLI command' unless command
      values = eval(command[1], TOPLEVEL_BINDING, ARGV[1])
      puts JSON.generate(values)
    `,
        path.join(root, 'example/ios/Podfile'),
        path.join(directory, 'Podfile'),
      ],
      { encoding: 'utf8' }
    );
    assert.equal(ruby.status, 0, ruby.stderr);
    const [executable, ...args] = JSON.parse(ruby.stdout);
    assert.equal(executable, 'node');
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      cwd: realpathSync(directory),
      argv: ['', '', 'config'],
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
