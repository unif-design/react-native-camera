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

test('Podfile raises only resource bundles below the React Native iOS minimum', () => {
  const result = spawnSync(
    'ruby',
    [
      '-rjson',
      '-rostruct',
      '-rrubygems',
      '-e',
      `
      def min_ios_version_supported; '15.1'; end
      def react_native_post_install(*); end
      bundle = 'com.apple.product-type.bundle'
      targets = [[bundle, '12.4'], [bundle, '15.1'], [bundle, '18.0'],
                 [bundle, nil], ['com.apple.product-type.library.static', '12.4']].map do |type, version|
        OpenStruct.new(product_type: type, build_configurations: [
          OpenStruct.new(build_settings: { 'IPHONEOS_DEPLOYMENT_TARGET' => version })
        ])
      end
      installer = OpenStruct.new(pods_project: OpenStruct.new(native_targets: targets))
      config = { reactNativePath: 'unused' }
      source = File.read(ARGV[0])
      post_install = source.match(/post_install do \\|installer\\|([\\s\\S]*)\\n  end\\nend/)
      raise 'missing post_install hook' unless post_install
      eval(post_install[1], binding, ARGV[0])
      puts JSON.generate(targets.map { |target|
        target.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      })
      `,
      path.join(root, 'example/ios/Podfile'),
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    '15.1',
    '15.1',
    '18.0',
    null,
    '12.4',
  ]);
});
