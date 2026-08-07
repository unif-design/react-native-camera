module.exports = {
  // 本文件只服务 jest(babel-jest)—— bob 用 `configFile: false` 编译,不读它,
  // 所以这里加插件不会进 lib/ 产物。
  //
  // worklets 插件是跑测试的硬需求:根 jest 现在经
  // `@unif/react-native-design/jest-preset` 用**真实** reanimated,而 `useAnimatedStyle`
  // 之类 hook 的依赖数组由该插件在编译期生成 —— 缺它 reanimated 直接抛
  // "`useAnimatedStyle` was used without a dependency array or Babel plugin"。
  // 位置对齐 example/babel.config.js(顶层 plugins,node_modules 一并处理),
  // 且必须是 `plugins` 的最后一项(这里是唯一一项)。
  plugins: ['react-native-worklets/plugin'],
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ['module:react-native-builder-bob/babel-preset'],
    },
    {
      include: /\/node_modules\//,
      presets: ['module:@react-native/babel-preset'],
    },
  ],
};
