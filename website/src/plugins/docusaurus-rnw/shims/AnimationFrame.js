/**
 * 为 Docusaurus SSG 补齐 Worklets Web 调度器依赖的动画帧 API。
 * 浏览器中始终委托原生实现；只有 Node SSR 环境才使用定时器兜底。
 */
'use strict';

function requestAnimationFrame(callback) {
  const nativeRequest = globalThis.requestAnimationFrame;
  if (
    typeof nativeRequest === 'function' &&
    nativeRequest !== requestAnimationFrame
  ) {
    return nativeRequest.call(globalThis, callback);
  }

  return setTimeout(() => callback(Date.now()), 16);
}

function cancelAnimationFrame(handle) {
  const nativeCancel = globalThis.cancelAnimationFrame;
  if (
    typeof nativeCancel === 'function' &&
    nativeCancel !== cancelAnimationFrame
  ) {
    nativeCancel.call(globalThis, handle);
    return;
  }

  clearTimeout(handle);
}

module.exports = { requestAnimationFrame, cancelAnimationFrame };
