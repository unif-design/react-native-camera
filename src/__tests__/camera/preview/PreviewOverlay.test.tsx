import type { ReactElement } from 'react';
import { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { IconButton } from '@unif/react-native-design';
import { PreviewOverlay } from '../../../camera/preview/PreviewOverlay';
import type { CapturedFile } from '../../../utils';
import { renderDark } from '../../__helpers__/renderDark';
import { makePhotoFile } from '../../__helpers__/factories';

// 删除原位确认使用 Design 组件；预览不依赖局部弹窗宿主。
const renderPreview = (ui: ReactElement) => renderDark(ui);

const rnCarouselRenderSpy = (
  jest.requireMock('react-native-reanimated-carousel') as {
    __carouselRenderSpy: jest.Mock;
  }
).__carouselRenderSpy;

type GetByTestId = ReturnType<typeof renderDark>['getByTestId'];

const layoutCarousel = (getByTestId: GetByTestId) => {
  fireEvent(getByTestId('camera-preview-carousel-track'), 'layout', {
    nativeEvent: {
      layout: { x: 0, y: 0, width: 390, height: 480 },
    },
  });
};

const f = (mode: CapturedFile['mode'], id: string) =>
  makePhotoFile({
    id,
    mode,
    path: `/${id}`,
    uri: `file:///${id}`,
  });

const noop = {
  onRetake: () => {},
  onSave: () => {},
  onBack: () => {},
  onDelete: () => {},
};

it('confirm 变体: 重拍/保存 在', () => {
  const { getByTestId } = renderPreview(
    <PreviewOverlay files={[f('single', 'a')]} variant="confirm" {...noop} />
  );
  expect(getByTestId('retake-btn')).toBeTruthy();
  expect(getByTestId('save-btn')).toBeTruthy();
});

it('gallery 变体: 返回/删除 在', () => {
  const { getByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
    />
  );
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
});

it('gallery 无完成按钮(保存统一走相机界面)', () => {
  const { queryByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
    />
  );
  expect(queryByTestId('complete-btn')).toBeNull();
});

it('点击当前 active tab 是 no-op,视觉页/计数/删除目标保持 settled 张', async () => {
  const deleted: string[] = [];
  const { getByRole, getByTestId, queryByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
      onDelete={(file) => deleted.push(file.id)}
    />
  );
  layoutCarousel(getByTestId);

  fireEvent.press(getByTestId('rnrc-snap-1'));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');

  const activeTab = getByTestId('type-tab-single');
  expect(activeTab).toBeDisabled();
  fireEvent.press(activeTab);
  expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');

  fireEvent.press(getByTestId('delete-btn'));
  expect(deleted).toEqual([]);
  expect(queryByTestId('confirm-scrim')).toBeNull();
  fireEvent.press(getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(deleted).toEqual(['b']));
});

it('Carousel 尚未落位时禁用删除,settled 后恢复', () => {
  const onDelete = jest.fn();
  const { getByTestId, queryByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
      onDelete={onDelete}
    />
  );
  layoutCarousel(getByTestId);

  fireEvent.press(getByTestId('rnrc-scroll-start'));
  expect(getByTestId('delete-btn')).toBeDisabled();
  fireEvent.press(getByTestId('delete-btn'));
  expect(queryByTestId('confirm-scrim')).toBeNull();
  expect(onDelete).not.toHaveBeenCalled();

  fireEvent.press(getByTestId('rnrc-snap-1'));
  expect(getByTestId('delete-btn')).not.toBeDisabled();
  expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');
});

it('Carousel moving 期间禁用类型切换,避免旧实例 settled 回调污染新 tab', () => {
  const { getByRole, getByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b'), f('video', 'v')]}
      variant="gallery"
      {...noop}
    />
  );
  layoutCarousel(getByTestId);

  const videoTab = getByTestId('type-tab-video');
  expect(videoTab).not.toBeDisabled();

  fireEvent.press(getByTestId('rnrc-scroll-start'));
  expect(videoTab).toBeDisabled();
  fireEvent.press(videoTab);

  expect(
    getByRole('tab', { name: /单拍/, selected: true, disabled: true })
  ).toBeTruthy();
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/2 张');
});

it('Carousel moving 期间 viewport width 变化时 remount 到 settled 页并解除禁用', async () => {
  const deleted: string[] = [];
  const previousWindow = Dimensions.get('window');
  const previousScreen = Dimensions.get('screen');
  rnCarouselRenderSpy.mockClear();
  const { getByRole, getByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
      onDelete={(file) => deleted.push(file.id)}
    />
  );
  layoutCarousel(getByTestId);

  try {
    fireEvent.press(getByTestId('rnrc-snap-1'));
    fireEvent.press(getByTestId('rnrc-scroll-start'));
    expect(getByTestId('delete-btn')).toBeDisabled();
    const callsBeforeResize = rnCarouselRenderSpy.mock.calls;
    const oldOnSnapToItem = callsBeforeResize[callsBeforeResize.length - 1]?.[0]
      ?.onSnapToItem as ((index: number) => void) | undefined;
    expect(oldOnSnapToItem).toEqual(expect.any(Function));

    act(() => {
      Dimensions.set({
        window: { ...previousWindow, width: previousWindow.width + 32 },
        screen: { ...previousScreen, width: previousScreen.width + 32 },
      });
    });

    await waitFor(() => expect(getByTestId('delete-btn')).not.toBeDisabled());
    expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');

    // resize 前旧实例排队到 RN thread 的 callback 晚到时必须忽略,否则会把逻辑页改回 a。
    act(() => oldOnSnapToItem?.(0));
    expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');

    fireEvent.press(getByTestId('delete-btn'));
    fireEvent.press(getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(deleted).toEqual(['b']));
  } finally {
    act(() => {
      Dimensions.set({
        window: previousWindow,
        screen: previousScreen,
      });
    });
  }
});

it('原位确认期间 settled index 改变，取消旧图确认且下一张必须重新确认', () => {
  const onDelete = jest.fn();
  const { getByRole, getByTestId, queryByRole } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
      onDelete={onDelete}
    />
  );
  layoutCarousel(getByTestId);

  // 发起时 settled=a;确认等待期间 Carousel 落到 b。
  fireEvent.press(getByTestId('delete-btn'));
  expect(getByRole('button', { name: '确认删除' })).toBeTruthy();
  fireEvent.press(getByTestId('rnrc-snap-1'));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');
  expect(queryByRole('button', { name: '确认删除' })).toBeNull();
  fireEvent.press(getByTestId('delete-btn'));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.press(getByRole('button', { name: '确认删除' }));
  expect(onDelete.mock.calls[0]?.[0].id).toBe('b');
});

it('滑动开始或点击预览其它位置会取消确认，重新确认才交付同一个原文件', async () => {
  const original = f('single', 'a');
  const onDelete = jest.fn();
  const view = renderPreview(
    <PreviewOverlay
      files={[original, f('single', 'b')]}
      variant="gallery"
      {...noop}
      onDelete={onDelete}
    />
  );
  layoutCarousel(view.getByTestId);
  fireEvent.press(view.getByTestId('delete-btn'));
  fireEvent(view.getByTestId('preview-overlay'), 'touchStart', {});
  expect(view.getByRole('button', { name: '确认删除' })).toBeTruthy();
  fireEvent(view.getByTestId('preview-overlay'), 'touchEnd', {});
  await waitFor(() =>
    expect(view.queryByRole('button', { name: '确认删除' })).toBeNull()
  );
  fireEvent.press(view.getByTestId('delete-btn'));
  fireEvent.press(view.getByTestId('rnrc-scroll-start'));
  expect(view.queryByRole('button', { name: '确认删除' })).toBeNull();
  expect(view.getByTestId('delete-btn')).toBeDisabled();
  fireEvent.press(view.getByTestId('rnrc-snap-0'));
  fireEvent.press(view.getByTestId('delete-btn'));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: '确认删除' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith(original);
});

it('切换媒体分类取消确认，新的分类必须重新点击两次', () => {
  const video = f('video', 'v');
  const onDelete = jest.fn();
  const view = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), video]}
      variant="gallery"
      {...noop}
      onDelete={onDelete}
    />
  );
  fireEvent.press(view.getByTestId('delete-btn'));
  fireEvent.press(view.getByTestId('type-tab-video'));
  expect(view.queryByRole('button', { name: '确认删除' })).toBeNull();
  fireEvent.press(view.getByTestId('delete-btn'));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: '确认删除' }));
  expect(onDelete).toHaveBeenCalledWith(video);
});

it('返回与卸载使确认失效，已经排队的旧点击不能删除文件', () => {
  const onDelete = jest.fn();
  const onBack = jest.fn();
  const view = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a')]}
      variant="gallery"
      {...noop}
      onDelete={onDelete}
      onBack={onBack}
    />
  );
  fireEvent.press(view.getByTestId('delete-btn'));
  const beforeBack = view.UNSAFE_getByType(IconButton).props.onPress;
  fireEvent.press(view.getByTestId('back-btn'));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(view.queryByRole('button', { name: '确认删除' })).toBeNull();
  act(() => beforeBack());
  expect(onDelete).not.toHaveBeenCalled();

  fireEvent.press(view.getByTestId('delete-btn'));
  const beforeUnmount = view.UNSAFE_getByType(IconButton).props.onPress;
  view.unmount();
  act(() => beforeUnmount());
  expect(onDelete).not.toHaveBeenCalled();
});

// 多张预览删除后停留页计数正确(#3 黑图的数据层根因:删除后 index 与 total 不能错位)。
// 用受控父级复刻 Container 的 onDelete(files.filter),验证删当前张后 total 更新、index 不越界。
it('gallery 删当前张:total 随之减少,onDelete 命中当前文件', async () => {
  const deleted: string[] = [];
  function Harness() {
    const [files, setFiles] = useState<CapturedFile[]>([
      f('single', 'a'),
      f('single', 'b'),
      f('single', 'c'),
    ]);
    return (
      <PreviewOverlay
        files={files}
        variant="gallery"
        {...noop}
        onDelete={(file) => {
          deleted.push(file.id);
          // 复刻 Container.onDelete:filter 掉被删项(身份相等)。
          setFiles((prev) => prev.filter((x) => x !== file));
        }}
      />
    );
  }
  const { getByRole, getByTestId } = renderPreview(<Harness />);

  // 初始 3 张,停在第 1 张(index 0)。
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/3 张');

  // 删当前张 → 原位显示确认文字 → 第二次点击才交付原文件。
  fireEvent.press(getByTestId('delete-btn'));
  fireEvent.press(getByRole('button', { name: '确认删除' }));

  // onDelete 命中当前文件(index 0 → 'a');删后剩 2 张,计数变 1/2(非 1/3 残值,非越界)。
  await waitFor(() => expect(deleted).toEqual(['a']));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/2 张');
});

it('gallery 删除末张:render-time safeIndex 让 remount/计数/下一次删除都落到新末张', async () => {
  const deleted: string[] = [];
  function Harness() {
    const [files, setFiles] = useState<CapturedFile[]>([
      f('single', 'a'),
      f('single', 'b'),
      f('single', 'c'),
    ]);
    return (
      <PreviewOverlay
        files={files}
        variant="gallery"
        {...noop}
        onDelete={(file) => {
          deleted.push(file.id);
          setFiles((prev) => prev.filter((x) => x.id !== file.id));
        }}
      />
    );
  }
  const { getByRole, getByTestId } = renderPreview(<Harness />);
  layoutCarousel(getByTestId);

  fireEvent.press(getByTestId('rnrc-snap-2'));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 3/3 张');
  fireEvent.press(getByTestId('delete-btn'));
  fireEvent.press(getByRole('button', { name: '确认删除' }));

  await waitFor(() => {
    expect(deleted).toEqual(['c']);
    expect(getByTestId('preview-counter')).toHaveTextContent('第 2/2 张');
  });

  // 若 current 仍用越界 index fallback data[0],这里会错删 a;正确目标是新末张 b。
  fireEvent.press(getByTestId('delete-btn'));
  fireEvent.press(getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(deleted).toEqual(['c', 'b']));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/1 张');
});
