import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const exampleRoot = join(root, 'example');
const websiteRoot = join(root, 'website');

function readExample(relativePath: string): string {
  return readFileSync(join(exampleRoot, relativePath), 'utf8');
}

function readWebsite(relativePath: string): string {
  return readFileSync(join(websiteRoot, relativePath), 'utf8');
}

it('安装后的 RN Gradle included build 使用兼容 Gradle 9 的 Foojay 1.0.0', () => {
  const settings = readFileSync(
    join(root, 'node_modules/@react-native/gradle-plugin/settings.gradle.kts'),
    'utf8'
  );

  expect(settings).toContain(
    'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")'
  );
  expect(settings).not.toContain(
    'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")'
  );
});

it('根、example 与 website 使用统一 RN 0.88.0 动画运行图且公共 peer 保留支持区间', () => {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const examplePkg = JSON.parse(readExample('package.json'));
  const websitePkg = JSON.parse(readWebsite('package.json'));
  const installedWebsiteReact = JSON.parse(
    readWebsite('node_modules/react/package.json')
  );
  const installedWebsiteReactDom = JSON.parse(
    readWebsite('node_modules/react-dom/package.json')
  );
  const installedWebsiteReactNative = JSON.parse(
    readWebsite('node_modules/react-native/package.json')
  );

  expect(rootPkg.devDependencies['react-native']).toBe('0.88.0');
  expect(examplePkg.dependencies['react-native']).toBe('0.88.0');
  expect(examplePkg.devDependencies['@react-native/metro-config']).toBe(
    '0.88.0'
  );
  expect(examplePkg.devDependencies['@react-native-community/cli']).toBe(
    '20.2.0'
  );
  expect(websitePkg.dependencies.react).toBe('19.3.0');
  expect(websitePkg.dependencies['react-dom']).toBe('19.3.0');
  expect(websitePkg.dependencies['react-native']).toBe('0.88.0');
  expect(installedWebsiteReact.version).toBe('19.3.0');
  expect(installedWebsiteReactDom.version).toBe('19.3.0');
  expect(installedWebsiteReactNative.version).toBe('0.88.0');
  for (const pkg of [
    rootPkg.devDependencies,
    examplePkg.dependencies,
    websitePkg.dependencies,
  ]) {
    expect(pkg['@callstack/liquid-glass']).toBe('0.8.2');
    expect(pkg['@unif/react-native-icons']).toBe('^0.4.1');
    expect(pkg['@sbaiahmed1/react-native-blur']).toBeUndefined();
    expect(pkg['react-native-reanimated']).toBe('4.7.1');
    expect(pkg['react-native-worklets']).toBe('0.13.0');
  }
  // 共享媒体调色板需要 Design 1.7，RN 支持下限保持 0.86。
  expect(rootPkg.peerDependencies.react).toBe('>=19.2.3 <20.0.0');
  expect(rootPkg.peerDependencies['react-native']).toBe('>=0.86.0');
  expect(rootPkg.peerDependencies['@callstack/liquid-glass']).toBe(
    '>=0.8.2 <0.9.0'
  );
  expect(
    rootPkg.peerDependencies['@sbaiahmed1/react-native-blur']
  ).toBeUndefined();
  expect(rootPkg.peerDependencies['@unif/react-native-design']).toBe('^1.7.0');
  expect(rootPkg.peerDependencies['react-native-reanimated']).toBe(
    '>=4.5.2 <4.8.0'
  );
  expect(rootPkg.peerDependencies['react-native-worklets']).toBe(
    '>=0.11.0 <0.14.0'
  );
  expect(rootPkg.devDependencies['@unif/react-native-design']).toBe('^1.7.0');
  expect(examplePkg.dependencies['@unif/react-native-design']).toBe('^1.7.0');
  expect(websitePkg.dependencies['@unif/react-native-design']).toBe('^1.7.0');
  expect(
    rootPkg.resolutions?.['@react-native/gradle-plugin@npm:0.85.0']
  ).toBeUndefined();
  expect(
    Object.keys(rootPkg.resolutions ?? {}).filter((key) =>
      key.includes('eslint-plugin-ft-flow')
    )
  ).toEqual([]);
});
