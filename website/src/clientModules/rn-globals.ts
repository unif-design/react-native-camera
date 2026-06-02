/**
 * 在 docusaurus 客户端启动前,把 React Native runtime 假定存在的全局对象注入到浏览器。
 *
 * RN 在 native runtime 下 `global` 直接指向 JS 引擎的 global object;`@gorhom/bottom-sheet`
 * 等库的 `lib/module/*.js` 编译产物会直接 `global.X` / `global.X = ...` / `typeof global`
 * 在文件顶层执行。webpack 5 默认不再 polyfill 这种 RN-isms,docusaurus 也不注入,所以
 * 浏览器里跑到这些文件就 `ReferenceError: global is not defined`。
 *
 * 这里在 client module(优先于业务 React 树启动)里把 `window.global = window`,
 * 比 webpack DefinePlugin 字面替换更稳:
 *  - 读 `global.X` ✓
 *  - 赋值 `global.X = ...` ✓(DefinePlugin 替换后会变成给 literal 赋值)
 *  - `typeof global` ✓
 *
 * 同样 alias `globalThis` 也确保 lib 里 `globalThis.X` 写法生效(标准已经统一)。
 */
if (typeof window !== 'undefined') {
  const w = window as unknown as { global?: unknown };
  if (typeof w.global === 'undefined') {
    w.global = window;
  }
}

// docusaurus client module 默认 export 空对象即可,不需要 React 组件。
export default {};
