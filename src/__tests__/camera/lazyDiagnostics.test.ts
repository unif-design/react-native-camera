import { createFileRegistry } from '../../camera/session/fileRegistry';

jest.mock('@unif/react-native-logger', () => ({
  createLogger: () => ({ warn: (...args: unknown[]) => mockWarn(...args) }),
  getFailureDiagnostics: (error: unknown) => mockDiagnostics(error),
}));
const mockWarn = jest.fn();
const mockDiagnostics = jest.fn((_error: unknown) => ({
  errorType: 'Error',
  reason: 'storage',
  sourceCode: 'EACCES',
}));
beforeEach(() => {
  mockWarn.mockClear();
  mockDiagnostics.mockReset().mockImplementation(() => ({
    errorType: 'Error',
    reason: 'storage',
    sourceCode: 'EACCES',
  }));
});

it('文件清理先完成所有权收尾，日志投影只提交给统一Logger生产器', async () => {
  const failure = new Error('PRIVATE_PHOTO_PATH');
  const unlink = jest.fn(async () => {
    throw failure;
  });
  const registry = createFileRegistry(unlink);
  registry.register('/private/photo.jpg');
  await expect(registry.drain()).resolves.toBeUndefined();
  expect(registry.stateOf('/private/photo.jpg')).toBe('deleted');
  expect(unlink).toHaveBeenCalledTimes(1);
  expect(mockDiagnostics).not.toHaveBeenCalled();
  const input: unknown = mockWarn.mock.calls[0]?.[1];
  if (typeof input !== 'function') throw new Error('missing metadata producer');
  expect(input()).toMatchObject({
    phase: 'cleanup',
    outcome: 'failed',
    fields: { sourceCode: 'EACCES' },
  });
  expect(mockDiagnostics).toHaveBeenCalledWith(failure);
});

it('错误诊断尚未执行或随后失败，都不重新取得文件或重复删除', async () => {
  const unlink = jest.fn(async () => {
    throw new Error('PRIVATE_ERROR');
  });
  const registry = createFileRegistry(unlink);
  registry.register('/private/photo.jpg');
  mockDiagnostics.mockImplementation(() => {
    throw new Error('diagnostic failed');
  });
  await registry.drain();
  expect(mockDiagnostics).not.toHaveBeenCalled();
  const input: unknown = mockWarn.mock.calls[0]?.[1];
  if (typeof input !== 'function') throw new Error('missing metadata producer');
  expect(() => input()).toThrow('diagnostic failed');
  await registry.drain();
  expect(unlink).toHaveBeenCalledTimes(1);
  expect(registry.stateOf('/private/photo.jpg')).toBe('deleted');
});
