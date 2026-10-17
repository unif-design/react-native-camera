import { createPhotoCleanupQueue } from '../../../camera/hooks/photoCleanupQueue';
import { createFileRegistry } from '../../../camera/session/fileRegistry';
it('an older passive effect preserves later-version files until their removal commits, and repeated flush is idempotent', async () => {
  const unlink = jest.fn().mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  registry.register('/raw-1');
  registry.register('/raw-2');
  const queue = createPhotoCleanupQueue(registry);
  const first = queue.enqueue({
    type: 'replace',
    rawPath: '/raw-1',
    finalPath: '/final-1',
  });
  const second = queue.enqueue({ type: 'delete', paths: ['/raw-2'] });
  queue.consume(first);
  expect(registry.stateOf('/raw-1')).toBe('deleted');
  expect(registry.stateOf('/final-1')).toBe('owned');
  expect(registry.stateOf('/raw-2')).toBe('owned');
  expect(unlink).toHaveBeenCalledTimes(1);
  queue.consume(first);
  queue.consume(second);
  queue.consume();
  expect(registry.stateOf('/raw-2')).toBe('deleted');
  expect(unlink.mock.calls).toEqual([['/raw-1'], ['/raw-2']]);
});
it('an unmounted owner flushes every pending version', () => {
  const unlink = jest.fn().mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  registry.register('/pending');
  const queue = createPhotoCleanupQueue(registry);
  queue.enqueue({ type: 'delete', paths: ['/pending'] });
  queue.consume();
  expect(registry.stateOf('/pending')).toBe('deleted');
});

it('a consumer registry extension may reject after cleanup without rolling back the committed media', async () => {
  const registry = createFileRegistry(jest.fn().mockResolvedValue(undefined));
  registry.register('/raw');
  // FileRegistry is an injected contract; this extension retains the real registry and
  // models a consumer-owned follow-up persistence failure after the physical cleanup.
  const queue = createPhotoCleanupQueue({
    ...registry,
    replace: async (raw, final) => {
      await registry.replace(raw, final);
      throw new Error('consumer persistence failed');
    },
  });
  queue.enqueue({ type: 'replace', rawPath: '/raw', finalPath: '/final' });
  queue.consume();
  await Promise.resolve();
  await Promise.resolve();
  expect(registry.stateOf('/raw')).toBe('deleted');
  expect(registry.stateOf('/final')).toBe('owned');
});
