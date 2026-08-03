import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const exampleRoot = join(root, 'example');
const websiteRoot = join(root, 'website');

function readExample(relativePath: string): string {
  return readFileSync(join(exampleRoot, relativePath), 'utf8');
}

function readWebsite(relativePath: string): string {
  return readFileSync(join(websiteRoot, relativePath), 'utf8');
}

type SourceInput = {
  fileName: string;
  sourceText: string;
};

type CameraWiringStats = {
  useCameraCalls: number;
  holderBindings: number;
  holderRenders: number;
};

function readSourceFiles(directory: string): SourceInput[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fileName = join(directory, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(fileName);
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      return [];
    }
    return [{ fileName, sourceText: readFileSync(fileName, 'utf8') }];
  });
}

function analyzeCameraWiring(
  sources: readonly SourceInput[]
): CameraWiringStats {
  let useCameraCalls = 0;
  let holderBindings = 0;
  let holderRenders = 0;

  for (const source of sources) {
    const sourceFile = ts.createSourceFile(
      source.fileName,
      source.sourceText,
      ts.ScriptTarget.Latest,
      true,
      source.fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const namedImports = new Set<string>();
    const namespaceImports = new Set<string>();

    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== '@unif/react-native-camera'
      ) {
        continue;
      }

      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly || !clause.namedBindings) {
        continue;
      }
      if (ts.isNamespaceImport(clause.namedBindings)) {
        namespaceImports.add(clause.namedBindings.name.text);
        continue;
      }

      for (const element of clause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (!element.isTypeOnly && importedName === 'useCamera') {
          namedImports.add(element.name.text);
        }
      }
    }

    const holderNames = new Set<string>();
    const isUseCameraCall = (node: ts.CallExpression): boolean => {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        return namedImports.has(expression.text);
      }
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression)
      ) {
        return (
          namespaceImports.has(expression.expression.text) &&
          expression.name.text === 'useCamera'
        );
      }
      if (
        ts.isElementAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        ts.isStringLiteral(expression.argumentExpression)
      ) {
        return (
          namespaceImports.has(expression.expression.text) &&
          expression.argumentExpression.text === 'useCamera'
        );
      }
      return false;
    };

    const collectBindings = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && isUseCameraCall(node)) {
        useCameraCalls += 1;
        const declaration = node.parent;
        if (
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer === node &&
          ts.isArrayBindingPattern(declaration.name)
        ) {
          const holderElement = declaration.name.elements[1];
          if (
            holderElement &&
            ts.isBindingElement(holderElement) &&
            ts.isIdentifier(holderElement.name)
          ) {
            holderBindings += 1;
            holderNames.add(holderElement.name.text);
          }
        }
      }
      ts.forEachChild(node, collectBindings);
    };
    collectBindings(sourceFile);

    const collectRenders = (node: ts.Node): void => {
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        ts.isIdentifier(node.expression) &&
        holderNames.has(node.expression.text)
      ) {
        holderRenders += 1;
      }
      ts.forEachChild(node, collectRenders);
    };
    collectRenders(sourceFile);
  }

  return { useCameraCalls, holderBindings, holderRenders };
}

function assertSingleCameraWiring(sources: readonly SourceInput[]): void {
  const stats = analyzeCameraWiring(sources);
  if (
    stats.useCameraCalls !== 1 ||
    stats.holderBindings !== 1 ||
    stats.holderRenders !== 1
  ) {
    throw new Error(
      `camera wiring contract violated: calls=${stats.useCameraCalls}, bindings=${stats.holderBindings}, renders=${stats.holderRenders}`
    );
  }
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

it('example App 以固定 Provider 顺序装配唯一 camera hook 与 holder', () => {
  const source = readExample('src/App.tsx');
  const sourceFiles = readSourceFiles(join(exampleRoot, 'src'));

  expect(source).toContain(
    "import { GestureHandlerRootView } from 'react-native-gesture-handler';"
  );
  expect(source).toMatch(
    /return\s*\(\s*<GestureHandlerRootView\s+style=\{rootStyles\.root\}>\s*<ThemeProvider>\s*<SafeAreaProvider>\s*<CameraShowcase\s*\/>\s*<\/SafeAreaProvider>\s*<\/ThemeProvider>\s*<\/GestureHandlerRootView>/
  );
  expect(source).toMatch(
    /const rootStyles = StyleSheet\.create\(\{\s*root: \{ flex: 1 \}/
  );
  expect(() => assertSingleCameraWiring(sourceFiles)).not.toThrow();
  expect(source).toMatch(
    /useMemo\(\s*\(\)\s*=>\s*createCameraRunController\(\{[\s\S]*?\bapi\b[\s\S]*?\}\),\s*\[api\]\s*\)/
  );
  expect(source).toMatch(
    /useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>\s*\{\s*api\.close\(\);\s*\},\s*\[api\]\s*\)/
  );
  expect(source).not.toMatch(/\bConfirmHost\b|\bToastHost\b/);
});

it('camera wiring AST contract 识别包根 named alias 与 namespace 调用', () => {
  const namedAlias: SourceInput = {
    fileName: 'NamedAlias.tsx',
    sourceText: `
      import { useCamera as useRootCamera } from '@unif/react-native-camera';
      export function NamedAlias() {
        const [, cameraPortal] = useRootCamera();
        return <>{cameraPortal}</>;
      }
    `,
  };
  const namespace: SourceInput = {
    fileName: 'Namespace.tsx',
    sourceText: `
      import * as CameraPackage from '@unif/react-native-camera';
      export function Namespace() {
        const [, holder] = CameraPackage.useCamera();
        return <>{holder}</>;
      }
    `,
  };

  expect(analyzeCameraWiring([namedAlias])).toEqual({
    useCameraCalls: 1,
    holderBindings: 1,
    holderRenders: 1,
  });
  expect(analyzeCameraWiring([namespace])).toEqual({
    useCameraCalls: 1,
    holderBindings: 1,
    holderRenders: 1,
  });
});

it('camera wiring AST contract 会拒绝第二个 useCamera call 与 holder', () => {
  const mutation: SourceInput = {
    fileName: 'SecondCamera.tsx',
    sourceText: `
      import * as CameraPackage from '@unif/react-native-camera';
      export function SecondCamera() {
        const [, firstHolder] = CameraPackage.useCamera();
        const [, secondHolder] = CameraPackage.useCamera();
        return <>{firstHolder}{secondHolder}</>;
      }
    `,
  };

  expect(() => assertSingleCameraWiring([mutation])).toThrow(
    'calls=2, bindings=2, renders=2'
  );
});

it('camera wiring AST contract 会拒绝同一 holder 的第二次渲染', () => {
  const mutation: SourceInput = {
    fileName: 'SecondHolderRender.tsx',
    sourceText: `
      import { useCamera as useRootCamera } from '@unif/react-native-camera';
      export function SecondHolderRender() {
        const [, cameraHolder] = useRootCamera();
        return <>{cameraHolder}{cameraHolder}</>;
      }
    `,
  };

  expect(() => assertSingleCameraWiring([mutation])).toThrow(
    'calls=1, bindings=1, renders=2'
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

it('iOS Podfile 将 RN CLI autolinking 锚定到 example 根目录', () => {
  const podfile = readExample('ios/Podfile');

  expect(podfile).toContain('config = use_native_modules!([');
  expect(podfile).toContain('process.chdir(#{File.dirname(__FILE__).to_json})');
  expect(podfile).toContain(
    "require.resolve('@react-native-community/cli', { paths: [process.cwd()] })"
  );
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

it('根、example 与 website 使用统一 RN 0.86.2 图且公共 RN peer 不收紧', () => {
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

  expect(rootPkg.devDependencies['react-native']).toBe('0.86.2');
  expect(examplePkg.dependencies['react-native']).toBe('0.86.2');
  expect(examplePkg.devDependencies['@react-native/metro-config']).toBe(
    '0.86.2'
  );
  expect(examplePkg.devDependencies['@react-native-community/cli']).toBe(
    '20.1.0'
  );
  expect(websitePkg.dependencies.react).toBe('19.2.3');
  expect(websitePkg.dependencies['react-dom']).toBe('19.2.3');
  expect(websitePkg.dependencies['react-native']).toBe('0.86.2');
  expect(installedWebsiteReact.version).toBe('19.2.3');
  expect(installedWebsiteReactDom.version).toBe('19.2.3');
  expect(installedWebsiteReactNative.version).toBe('0.86.2');
  expect(rootPkg.peerDependencies['react-native']).toBe('>=0.85.0');
  expect(
    rootPkg.resolutions?.['@react-native/gradle-plugin@npm:0.85.0']
  ).toBeUndefined();
  expect(
    Object.keys(rootPkg.resolutions ?? {}).filter((key) =>
      key.includes('eslint-plugin-ft-flow')
    )
  ).toEqual([]);
});
