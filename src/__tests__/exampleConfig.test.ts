import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const exampleRoot = join(root, 'example');

function readExample(relativePath: string): string {
  return readFileSync(join(exampleRoot, relativePath), 'utf8');
}

function pluginName(plugin: unknown): unknown {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function plistArray(source: string, key: string): string[] {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(
    `<key>${escapedKey}</key>\\s*<array>([\\s\\S]*?)</array>`
  ).exec(source)?.[1];
  if (body == null) return [];

  return Array.from(body.matchAll(/<string>([^<]*)<\/string>/g), (match) => {
    const value = match[1];
    if (value == null) throw new Error(`invalid plist array: ${key}`);
    return value;
  });
}

function permissionTag(source: string, permission: string): string | undefined {
  return (source.match(/<uses-permission\b[^>]*\/>/g) ?? []).find((tag) =>
    tag.includes(`android:name="${permission}"`)
  );
}

it('example Babel 最后加载 Worklets plugin', () => {
  const configPath = join(exampleRoot, 'babel.config.js');
  jest.resetModules();
  const config = require(configPath) as { plugins?: unknown[] };
  const plugins = config.plugins ?? [];

  expect(pluginName(plugins.at(-1))).toBe('react-native-worklets/plugin');
});

it('example App 以 flex:1 GestureHandlerRootView 为根', () => {
  const source = readExample('src/App.tsx');

  expect(source).toContain(
    "import { GestureHandlerRootView } from 'react-native-gesture-handler';"
  );
  expect(source).toMatch(
    /return\s*\(\s*<GestureHandlerRootView\s+style=\{rootStyles\.root\}>/
  );
  expect(source).toMatch(
    /const rootStyles = StyleSheet\.create\(\{\s*root: \{ flex: 1 \}/
  );
});

it('example 显式安装 workspace camera 与照片处理、录像 native peers', () => {
  const pkg = JSON.parse(readExample('package.json')) as {
    dependencies?: Record<string, string>;
  };

  expect(pkg.dependencies).toEqual(
    expect.objectContaining({
      '@unif/react-native-camera': 'workspace:*',
      '@dr.pogodin/react-native-fs': '^2.38.2',
      '@shopify/react-native-skia': '^2.6.4',
      'react-native-video': '7.0.0-beta.9',
    })
  );
  expect(pkg.dependencies?.['react-native-fs']).toBeUndefined();
});

it('iPhone 宿主开放正向竖屏与左右横屏且不声明相册、空定位权限', () => {
  const plist = readExample('ios/ReactNativeCameraExample/Info.plist');

  expect(plistArray(plist, 'UISupportedInterfaceOrientations')).toEqual([
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
  ]);
  expect(plist).not.toContain('<key>NSPhotoLibraryAddUsageDescription</key>');
  expect(plist).not.toContain('<key>NSLocationWhenInUseUsageDescription</key>');
});

it('Android 仅保留相机、录像权限并精确移除传递的旧写存储权限', () => {
  const manifest = readExample('android/app/src/main/AndroidManifest.xml');

  expect(permissionTag(manifest, 'android.permission.CAMERA')).toBeDefined();
  expect(
    permissionTag(manifest, 'android.permission.RECORD_AUDIO')
  ).toBeDefined();
  expect(
    permissionTag(manifest, 'android.permission.READ_MEDIA_IMAGES')
  ).toBeUndefined();
  expect(
    permissionTag(manifest, 'android.permission.WRITE_EXTERNAL_STORAGE')
  ).toContain('tools:node="remove"');
  expect(manifest).toContain('xmlns:tools="http://schemas.android.com/tools"');
});

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

it('根 package 只为 RN Gradle plugin 0.85.0 保存 exact Yarn patch resolution', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    resolutions?: Record<string, string>;
  };
  const gradlePluginResolutions = Object.entries(pkg.resolutions ?? {}).filter(
    ([descriptor]) => descriptor.startsWith('@react-native/gradle-plugin@')
  );

  expect(gradlePluginResolutions).toEqual([
    [
      '@react-native/gradle-plugin@npm:0.85.0',
      expect.stringMatching(
        /^patch:@react-native\/gradle-plugin@npm%3A0\.85\.0#~\/\.yarn\/patches\/@react-native-gradle-plugin-npm-0\.85\.0-[a-f0-9]+\.patch$/
      ),
    ],
  ]);
});
