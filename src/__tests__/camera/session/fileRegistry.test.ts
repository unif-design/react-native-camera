import { createFileRegistry } from '../../../camera/session/fileRegistry';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('FileRegistry', () => {
  it('register 后只把新路径标记为 owned', () => {
    const unlink = jest.fn<Promise<void>, [string]>();
    const registry = createFileRegistry(unlink);

    registry.register('/raw.jpg');
    registry.register('/raw.jpg');

    expect(registry.stateOf('/raw.jpg')).toBe('owned');
    expect(unlink).not.toHaveBeenCalled();
  });

  it('delete 在 await 前同步标记 deleted，重复调用只 unlink 一次', async () => {
    const pending = deferred();
    const unlink = jest.fn(() => pending.promise);
    const registry = createFileRegistry(unlink);
    registry.register('/raw.jpg');

    const first = registry.delete('/raw.jpg');
    const second = registry.delete('/raw.jpg');

    expect(registry.stateOf('/raw.jpg')).toBe('deleted');
    expect(unlink).toHaveBeenCalledTimes(1);
    pending.resolve();
    await Promise.all([first, second]);
  });

  it('replace 先登记 final，再摘除并删除 raw', async () => {
    let registry!: ReturnType<typeof createFileRegistry>;
    const unlink = jest.fn(async (path: string) => {
      expect(path).toBe('/raw.jpg');
      expect(registry.stateOf('/final.jpg')).toBe('owned');
      expect(registry.stateOf('/raw.jpg')).toBe('deleted');
    });
    registry = createFileRegistry(unlink);
    registry.register('/raw.jpg');

    await registry.replace('/raw.jpg', '/final.jpg');

    expect(registry.stateOf('/final.jpg')).toBe('owned');
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('transfer 后 drain 保留消费者路径并删除其余 owned 文件', async () => {
    const unlink = jest.fn(async (_path: string) => {});
    const registry = createFileRegistry(unlink);
    ['/raw.jpg', '/intermediate.jpg', '/result.jpg'].forEach((path) =>
      registry.register(path)
    );

    registry.transfer(['/result.jpg']);
    const cleanup = registry.drain();

    expect(registry.stateOf('/result.jpg')).toBe('transferred');
    expect(registry.stateOf('/raw.jpg')).toBe('deleted');
    expect(registry.stateOf('/intermediate.jpg')).toBe('deleted');
    await cleanup;
    expect(unlink.mock.calls.map(([path]) => path).sort()).toEqual([
      '/intermediate.jpg',
      '/raw.jpg',
    ]);
  });

  it('从不 unlink 未登记或已 transferred 的路径', async () => {
    const unlink = jest.fn(async () => {});
    const registry = createFileRegistry(unlink);
    registry.register('/result.jpg');
    registry.transfer(['/result.jpg', '/foreign.jpg']);

    await registry.delete('/foreign.jpg');
    await registry.delete('/result.jpg');
    await registry.drain();

    expect(registry.stateOf('/foreign.jpg')).toBeUndefined();
    expect(registry.stateOf('/result.jpg')).toBe('transferred');
    expect(unlink).not.toHaveBeenCalled();
  });

  it('单个 unlink reject 不阻断其他路径且 drain resolve', async () => {
    const unlink = jest.fn(async (path: string) => {
      if (path === '/bad.jpg') throw new Error('disk busy');
    });
    const registry = createFileRegistry(unlink, jest.fn());
    registry.register('/bad.jpg');
    registry.register('/good.jpg');

    await expect(registry.drain()).resolves.toBeUndefined();

    expect(unlink).toHaveBeenCalledTimes(2);
    expect(registry.stateOf('/bad.jpg')).toBe('deleted');
    expect(registry.stateOf('/good.jpg')).toBe('deleted');
  });

  it('unlink reject 注入可诊断事件，reporter 抛错也不阻断 drain', async () => {
    const unlinkError = new Error('disk busy');
    const reporter = jest.fn(() => {
      throw new Error('reporter failed');
    });
    const registry = createFileRegistry(
      jest.fn(async () => {
        throw unlinkError;
      }),
      reporter
    );
    registry.register('/bad.jpg');

    await expect(registry.drain()).resolves.toBeUndefined();

    expect(reporter).toHaveBeenCalledWith({
      path: '/bad.jpg',
      error: unlinkError,
    });
    expect(registry.stateOf('/bad.jpg')).toBe('deleted');
  });

  it('未注入 reporter 时通过默认 warning 暴露 unlink 失败', async () => {
    const unlinkError = new Error('disk busy');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = createFileRegistry(
      jest.fn(async () => {
        throw unlinkError;
      })
    );
    registry.register('/bad.jpg');

    await expect(registry.delete('/bad.jpg')).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('/bad.jpg'),
      unlinkError
    );
    warn.mockRestore();
  });

  it('一次 drain 后晚到 operation 仍可登记并独立清理', async () => {
    const unlink = jest.fn(async () => {});
    const registry = createFileRegistry(unlink);
    registry.register('/early.jpg');
    await registry.drain();

    registry.register('/late.jpg');
    expect(registry.stateOf('/late.jpg')).toBe('owned');
    await registry.delete('/late.jpg');

    expect(unlink).toHaveBeenNthCalledWith(1, '/early.jpg');
    expect(unlink).toHaveBeenNthCalledWith(2, '/late.jpg');
  });

  it('stale Recorder callback 只登记并删除旧 session 自己的路径', async () => {
    const oldUnlink = jest.fn(async () => {});
    const currentUnlink = jest.fn(async () => {});
    const oldSession = createFileRegistry(oldUnlink);
    const currentSession = createFileRegistry(currentUnlink);

    // Recorder finish 必须在 token 判断前登记到创建它的 session；判断为 stale 后从同一处删除。
    oldSession.register('/late-video.mp4');
    await oldSession.delete('/late-video.mp4');

    expect(oldSession.stateOf('/late-video.mp4')).toBe('deleted');
    expect(oldUnlink).toHaveBeenCalledWith('/late-video.mp4');
    expect(currentSession.stateOf('/late-video.mp4')).toBeUndefined();
    expect(currentUnlink).not.toHaveBeenCalled();
  });
});
