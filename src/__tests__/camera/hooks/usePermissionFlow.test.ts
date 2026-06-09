import { renderHook, waitFor } from '@testing-library/react-native';
import { usePermissionFlow } from '../../../camera/hooks/usePermissionFlow';

// usePermissionFlow 依赖 useCameraPermission。这里逐用例覆盖 vision-camera mock:
// 控制 hasPermission 初值 + requestPermission 的 resolve/reject,验证状态机流转。
// 名字以 mock 开头:babel-jest-hoist 把 jest.mock 提到 import 上,仅允许工厂引用 mock* 前缀变量。
let mockHasPermission = false;
let mockRequestImpl: () => Promise<boolean> = () => Promise.resolve(false);

jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({
    get hasPermission() {
      return mockHasPermission;
    },
    requestPermission: () => mockRequestImpl(),
  }),
}));

beforeEach(() => {
  mockHasPermission = false;
  mockRequestImpl = () => Promise.resolve(false);
});

it('已有权限:初值即 granted,不请求', () => {
  mockHasPermission = true;
  const request = jest.fn(() => Promise.resolve(true));
  mockRequestImpl = request;
  const { result } = renderHook(() => usePermissionFlow());
  expect(result.current).toBe('granted');
  expect(request).not.toHaveBeenCalled();
});

it('无权限 → 请求中为 pending,授予后 granted', async () => {
  let resolve!: (ok: boolean) => void;
  mockRequestImpl = () => new Promise<boolean>((res) => (resolve = res));
  const { result } = renderHook(() => usePermissionFlow());
  // 请求未 settle 前停留 pending
  expect(result.current).toBe('pending');
  resolve(true);
  await waitFor(() => expect(result.current).toBe('granted'));
});

it('无权限 → 用户拒绝 → denied', async () => {
  mockRequestImpl = () => Promise.resolve(false);
  const { result } = renderHook(() => usePermissionFlow());
  await waitFor(() => expect(result.current).toBe('denied'));
});

it('requestPermission reject(Android #3834 兜底)→ denied,不抛', async () => {
  // 关键:Android 并行调用会 leak coroutine,hook 必须 .catch 兜底成 denied,绝不让 rejection 冒泡。
  mockRequestImpl = () => Promise.reject(new Error('coroutine leak'));
  const { result } = renderHook(() => usePermissionFlow());
  await waitFor(() => expect(result.current).toBe('denied'));
});

it('卸载后 resolve 不再 setState(cancelled 守卫)', async () => {
  let resolve!: (ok: boolean) => void;
  mockRequestImpl = () => new Promise<boolean>((res) => (resolve = res));
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { result, unmount } = renderHook(() => usePermissionFlow());
  expect(result.current).toBe('pending');
  unmount();
  // 卸载后 promise 才 settle:cancelled 守卫应阻止对已卸载组件 setState(无 act 警告)。
  resolve(true);
  await Promise.resolve();
  expect(errSpy).not.toHaveBeenCalled();
  errSpy.mockRestore();
});
