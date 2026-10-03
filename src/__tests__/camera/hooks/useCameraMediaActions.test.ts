import { act, renderHook } from '@testing-library/react-native';
import { useCameraMediaActions } from '../../../camera/hooks/useCameraMediaActions';
import { useCameraSessionController } from '../../../camera/hooks/useCameraSessionController';
import { createFileRegistry } from '../../../camera/session/fileRegistry';
import type { CapturedFile } from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

function setup({ files }: { files: CapturedFile[] }) {
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const fileRegistry = createFileRegistry(unlink);
  files.forEach((file) => fileRegistry.register(file.path));
  const onSettle = jest.fn();
  const hook = renderHook(() => {
    const controller = useCameraSessionController({
      sessionId: 41,
      initialState: {
        files,
        modeIndex: 0,
        aspectRatio: '16:9',
        activePosition: 'back',
        canFlip: true,
        flash: 'off',
        sound: false,
        nativeConfigurationKey: 'back-1',
      },
      registerController: () => () => {},
      confirm: async () => true,
      cancelRecording: () => {},
      onSettle,
    });
    return { controller, ...useCameraMediaActions(controller, fileRegistry) };
  });
  act(() => {
    hook.result.current.controller.configured(0);
  });
  return { ...hook, fileRegistry, unlink, onSettle };
}

async function flushMicrotasks() {
  await Promise.resolve();
}

describe.each(['photo', 'video'] as const)('%s 媒体操作', (kind) => {
  const makeMedia = (overrides: Partial<CapturedFile>) =>
    makePhotoFile({
      ...overrides,
      ...(kind === 'video' ? { mode: 'video', mimeType: 'video/mp4' } : {}),
    });
  it('deleteMedia 按实际摘除文件执行 owned cleanup', async () => {
    const first = makeMedia({ id: 'first', path: '/first.jpg' });
    const second = makeMedia({ id: 'second', path: '/second.jpg' });
    const harness = setup({ files: [first, second] });

    act(() => {
      expect(harness.result.current.openGallery()).toBe(true);
      expect(harness.result.current.deleteMedia(first)).toBe(true);
    });
    await act(flushMicrotasks);

    expect(harness.result.current.controller.state.files).toEqual([second]);
    expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
    expect(harness.fileRegistry.stateOf(second.path)).toBe('owned');
  });

  it('clear 清空 preview files 并逐个执行 owned cleanup', async () => {
    const first = makeMedia({ id: 'first', path: '/first.jpg' });
    const second = makeMedia({ id: 'second', path: '/second.jpg' });
    const harness = setup({ files: [first, second] });

    act(() => {
      expect(harness.result.current.openGallery()).toBe(true);
      expect(harness.result.current.clear()).toBe(true);
    });
    await act(flushMicrotasks);

    expect(harness.result.current.controller.state).toMatchObject({
      phase: 'ready',
      files: [],
      preview: null,
    });
    expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
    expect(harness.fileRegistry.stateOf(second.path)).toBe('deleted');
  });

  it('clear 从 ready 清空快照并逐个执行 owned cleanup', async () => {
    const first = makeMedia({ id: 'first', path: '/first.jpg' });
    const second = makeMedia({ id: 'second', path: '/second.jpg' });
    const harness = setup({ files: [first, second] });

    act(() => {
      expect(harness.result.current.clear()).toBe(true);
    });
    await act(flushMicrotasks);

    expect(harness.result.current.controller.state.files).toEqual([]);
    expect(harness.fileRegistry.stateOf(first.path)).toBe('deleted');
    expect(harness.fileRegistry.stateOf(second.path)).toBe('deleted');
  });

  it('save 只 settle 最新 files，不提前 transfer 或 delete', () => {
    const first = makeMedia({ id: 'first', path: '/first.jpg' });
    const harness = setup({ files: [first] });

    act(() => {
      expect(harness.result.current.save()).toBe(true);
    });

    expect(harness.onSettle).toHaveBeenCalledWith({
      status: 'success',
      media: [first],
    });
    expect(harness.fileRegistry.stateOf(first.path)).toBe('owned');
    expect(harness.unlink).not.toHaveBeenCalled();
  });
});
