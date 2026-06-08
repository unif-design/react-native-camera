/**
 * 让 Docusaurus 能直接 import `@unif/react-native-camera` 源码并在浏览器渲染：
 *   - `react-native` → `react-native-web` 别名
 *   - `@unif/react-native-camera$` → `<repo>/src/index.ts`(显式 alias 兜底,
 *      webpack 5 不识 package.json 的 `exports.source` 条件;同时保持源码 hot reload)
 *   - `@unif/react-native-design` 走 node_modules(已发布的 lib/module),不 alias
 *   - 把 `<repo>/src/**` 与 ESM-shipped 的几个 RN 库纳入 babel-loader 处理范围
 *   - reanimated 4 需要 `react-native-worklets/plugin`,必须放在 babel plugins 链最后
 *
 * Native module(相机/视频录制)在浏览器里没有原生侧,
 * 只能渲染组件 UI 预览,真实相机功能调用要在 RN runtime。
 */
'use strict';

const path = require('path');
const webpack = require('webpack');

module.exports = function reactNativeWebPlugin(context) {
  // context.siteDir = <repo>/website ; 上一级是 <repo>(camera 仓根)。
  const projectRoot = path.resolve(context.siteDir, '..');
  const srcDir = path.join(projectRoot, 'src');
  const rnghPressableShim = path.join(__dirname, 'shims/RnghPressable.js');

  // 几个 ESM-shipped 且带 Flow / TS 注解的 RN 库要让 babel-loader 处理（默认 node_modules 不走 babel）。
  // 用 regex 匹配，因为这些包同时在 root 和 website/ 两份 node_modules 下都可能存在。
  // @sbaiahmed1/react-native-blur 等库的 lib/module 里有 .ts NativeComponent
  // 规范文件,带 import type 等 TS 语法,默认 webpack parser 解析不了,需要 babel + preset-typescript。
  const rnPackagesPattern =
    /node_modules\/(react-native-(?:reanimated|worklets|gesture-handler|keyboard-controller|svg|safe-area-context|web)|@sbaiahmed1\/react-native-blur)\//;

  return {
    name: 'docusaurus-rnw',

    configureWebpack(_config, isServer) {
      return {
        plugins: [
          // RN 与各 RN 库都假设 __DEV__ 是个全局布尔；浏览器里得自己注入。
          // 注意:RN 库还会用全局变量 `global`(读写 / typeof 都有),那个由
          // `website/src/clientModules/rn-globals.ts` 在 client boot 时 `window.global = window`
          // 真实注入(比 DefinePlugin 字面替换更稳;赋值/typeof 场景都能 handle)。
          new webpack.DefinePlugin({
            '__DEV__': JSON.stringify(
              !isServer ? process.env.NODE_ENV !== 'production' : false
            ),
            'process.env.JEST_WORKER_ID': JSON.stringify(undefined),
          }),
          // RNGH 的 Pressable 实现依赖 GestureDetector + reanimated worklets + Gesture objects 链，
          // 在 react-native-web 环境里 onPress 完全不触发（实测：原生 click / pointerdown / mousedown 都无效）。
          // RNGH 包内是相对 import `./components/Pressable`，webpack alias 对相对路径不生效，
          // 改用 NormalModuleReplacementPlugin 在 module 解析阶段强制重定向到 shim（用 RNW 的 Pressable）。
          // 仅 web bundle 走 shim，RN native 端仍用 RNGH 原版保留 native 性能。
          new webpack.NormalModuleReplacementPlugin(
            /^\.\/components\/Pressable$/,
            (resource) => {
              if (
                resource.context &&
                resource.context.includes('react-native-gesture-handler')
              ) {
                resource.request = rnghPressableShim;
              }
            }
          ),
        ],
        // module.rules 必须 prepend，否则我们的 rule 会被 oneOf 短路掉。
        // resolve.extensions 也要 prepend，否则 .web.js 会排在 .js 后面，
        // webpack 优先解析到非 web 版的 RNGH/Reanimated 入口、运行期就崩。
        mergeStrategy: {
          'module.rules': 'prepend',
          'resolve.extensions': 'prepend',
        },
        resolve: {
          alias: {
            // 把 RN 内置入口换成 RNW；$ 表示精确匹配，不影响 react-native-* 的子包。
            'react-native$': 'react-native-web',
            // RN 一些深路径（fabric / codegen / TurboModule specs）只有 native runtime 才执行；
            // web 上让它们解析为空模块，避开 Flow 语法解析失败和 missing 导出警告。
            // 业务侧若用到 codegen 类原生组件(如 @sbaiahmed1/react-native-blur 的 BlurView),
            // 在该 RN 组件的 wrapper 旁边加 `<Comp>.web.tsx` 条件入口用 CSS 等价物重写。
            'react-native/Libraries': false,
            'react-native/src': false,
            // 把 npm 包名 `@unif/react-native-camera` 显式指向 src/index.ts 源码:
            //  - webpack 5 默认不识 package.json 的 `exports.source` 条件,直接 import npm 名
            //    会拿到 lib/module/index.js(bob 编译产物),热更新链路断;
            //  - 即便仓库内通过 yarn workspaces 把 npm 名 symlink 到本地源码,源码里又有 `@/*`
            //    barrel,也得让 webpack 解析到源码本体而非编译产物。
            //  - `$` 精确匹配,不影响 `@unif/react-native-camera/<subpath>` 写法。
            '@unif/react-native-camera$': path.resolve(srcDir, 'index.ts'),
          },
          // RNW / 多平台库会用 .web.js / .web.tsx 等后缀提供 web-specific 实现。
          extensions: [
            '.web.tsx',
            '.web.ts',
            '.web.jsx',
            '.web.js',
            '.tsx',
            '.ts',
            '.jsx',
            '.js',
            '.json',
          ],
        },
        module: {
          rules: [
            {
              test: /\.(tsx|ts|jsx|mjs|js)$/,
              include: [srcDir, rnPackagesPattern],
              use: {
                loader: require.resolve('babel-loader'),
                options: {
                  babelrc: false,
                  configFile: false,
                  cacheDirectory: true,
                  presets: [
                    [
                      require.resolve('@babel/preset-env'),
                      { targets: 'defaults', loose: true },
                    ],
                    [
                      require.resolve('@babel/preset-react'),
                      { runtime: 'automatic' },
                    ],
                    require.resolve('@babel/preset-typescript'),
                    // RN 一些 .js 源里带 Flow 类型注解，需要先剥掉。
                    [require.resolve('@babel/preset-flow'), { all: true }],
                  ],
                  plugins: [
                    // reanimated 4 worklet 转换。必须放最后(在所有其它 transform 之后跑)。
                    require.resolve('react-native-worklets/plugin'),
                  ],
                },
              },
            },
            {
              test: /\.(png|jpe?g|gif|webp)$/,
              include: [srcDir],
              type: 'asset/resource',
            },
            // node_modules 里 ESM-shipped RN 库(@sbaiahmed1/react-native-blur、
            // @react-navigation/native 等)用相对 import 不带后缀。webpack 5 严格 ESM 拒收;
            // 放宽 fullySpecified 让 webpack 按 resolve.extensions 兜底找文件。
            // 仅作用于 node_modules,不影响 srcDir(我们的代码走 babel-loader 上面那条规则)。
            {
              test: /\.m?js$/,
              include: /node_modules/,
              resolve: { fullySpecified: false },
            },
          ],
        },
      };
    },
  };
};
