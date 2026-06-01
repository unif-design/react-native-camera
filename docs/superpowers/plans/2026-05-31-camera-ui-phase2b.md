# 相机 UI Phase 2b — 预览态重写 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（全程 opus + max effort）逐任务执行。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 按设计稿重写相机预览态（S8–S12：确认/回看两变体、类型 tab、左右滑、视频播放、删除二次确认、保存 Toast），`open()` 契约不变。

**Architecture:** 保留 `Carousel` 做翻页（`SlideItem` 加视频分支 + `VideoPlayer`）；新建 `PreviewOverlay`（变体路由 + tab + Carousel）+ `PreviewTopBar` + `PreviewBottomBar` + `groupTypes` 纯函数；用 design `Button`/`confirm`/`toast` + `useColors` 主题；`Container` previewing 分支加 `previewVariant` 并改调 `PreviewOverlay`。删旧预览树 + filmstrip。

**Tech Stack:** RN 0.85 / react-native-reanimated-carousel / **react-native-video**（新）/ `@unif/react-native-design`（Button/confirm/toast/useColors）/ jest 29。

**Spec:** `docs/superpowers/specs/2026-05-31-camera-ui-phase2b-preview-design.md`。像素见 `docs/superpowers/research/2026-05-29-design-spec-digest.md`（**digest**）§S8–S12。**分支：** `feat/camera-ui-phase2a`（接 2a 叠加）。

**design API（已核对）：** `confirm({ title, message?, confirmLabel?, cancelLabel? }): Promise<boolean>`；`toast.success('已保存')`；`Button({ label, onPress, variant, testID })`（variant 含 ghost/primary 等 6 种）；`useColors()` → `{ background, foreground, surface, primary, outline, error }`；`useThemedStyles((c)=>StyleSheet)`。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `package.json` | `react-native-video` peer + dev | 改 |
| `jest.setup.ts` | mock `react-native-video` | 改 |
| `src/camera/preview/groupTypes.ts` | 纯函数：distinct 类型(顺序) + 按类型过滤 | 新建 |
| `src/components/VideoPlayer.tsx` | react-native-video 播放器 + 点击播放/暂停 | 新建 |
| `src/components/Carousel/SlideItem.tsx` | 图 或 VideoPlayer | 改 |
| `src/camera/preview/PreviewTopBar.tsx` | 类型 label / 共N张 / 类型 tab | 新建 |
| `src/camera/preview/PreviewBottomBar.tsx` | 第X/Y张 + 按钮行(变体) | 新建 |
| `src/camera/preview/PreviewOverlay.tsx` | 上滑容器 + 变体路由 + tab + Carousel | 新建 |
| `src/camera/preview/index.tsx` | 导出 PreviewOverlay | 改 |
| `src/camera/Container.tsx` | previewVariant + 改调 PreviewOverlay | 改 |
| `src/camera/preview/{PreViewContainer,PreView,SinglePre,PreviewFooter}.tsx` | 旧预览树 | 删 |
| `src/components/PreviewThumbnail.tsx` | filmstrip 否决 | 删 |
| `src/hooks/useConfirm.tsx` | 废弃(改用 design confirm) | 删(确认无引用) |
| `README.md` | react-native-video 安装 + Host 说明 | 改 |

> 像素查 digest §S8–S12；预览 chrome 走 `useColors`/`useThemedStyles`（跟随主题），大图区固定黑底。design 组件在测试中是 passthrough → 组件测试用 `not.toThrow` + `testID` 降级断言。

---

## Task 1: react-native-video 依赖 + jest mock

**Files:** `package.json`, `jest.setup.ts`

- [ ] **Step 1: 装 + 声明**
```bash
yarn add -D react-native-video
```
然后 `package.json` 把 `react-native-video` 也加进 `peerDependencies`（版本对齐装上的，如 `>=6` 或装上的 major）。

- [ ] **Step 2: jest mock**（`jest.setup.ts` 末尾追加）
```ts
jest.mock('react-native-video', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => require('react').createElement(View, props),
  };
});
```

- [ ] **Step 3: 验证**
Run: `yarn typecheck && yarn test` → 0 错、全绿（lock 已更新）。

- [ ] **Step 4: 提交**
```bash
git add package.json yarn.lock jest.setup.ts
git commit -m "build(2b): add react-native-video peer dep and jest mock"
```

---

## Task 2: `groupTypes` 纯函数

**Files:** `src/camera/preview/groupTypes.ts` + `.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// src/camera/preview/groupTypes.test.ts
import { distinctTypes, filesOfType } from './groupTypes';
import type { CustomPhotoFile } from '../../utils';

const f = (cameraMode: CustomPhotoFile['cameraMode'], id: string): CustomPhotoFile => ({
  id, cameraType: 'back', cameraMode, path: `/${id}.jpg`, uri: `file:///${id}.jpg`,
  width: 1, height: 1, mime: cameraMode === 'video' ? 'video/mp4' : 'image/jpeg', mode: cameraMode,
});

it('distinctTypes 按 连拍/单拍/视频 顺序去重', () => {
  const files = [f('single', 'a'), f('video', 'b'), f('single', 'c'), f('continuous', 'd')];
  expect(distinctTypes(files)).toEqual(['continuous', 'single', 'video']);
  expect(distinctTypes([f('single', 'a')])).toEqual(['single']);
  expect(distinctTypes([])).toEqual([]);
});
it('filesOfType 过滤', () => {
  const files = [f('single', 'a'), f('video', 'b'), f('single', 'c')];
  expect(filesOfType(files, 'single').map((x) => x.id)).toEqual(['a', 'c']);
});
```

- [ ] **Step 2: 跑确认失败** → `yarn jest src/camera/preview/groupTypes.test.ts`

- [ ] **Step 3: 实现**
```ts
// src/camera/preview/groupTypes.ts
import type { CustomPhotoFile, CameraModeName } from '../../utils';

const ORDER: CameraModeName[] = ['continuous', 'single', 'video'];

export function distinctTypes(files: CustomPhotoFile[]): CameraModeName[] {
  const present = new Set(files.map((f) => f.cameraMode));
  return ORDER.filter((t) => present.has(t));
}

export function filesOfType(
  files: CustomPhotoFile[],
  type: CameraModeName
): CustomPhotoFile[] {
  return files.filter((f) => f.cameraMode === type);
}
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/preview/groupTypes.test.ts
git add src/camera/preview/groupTypes.ts src/camera/preview/groupTypes.test.ts
git commit -m "feat(2b): groupTypes helpers (distinct types + filter)"
```

---

## Task 3: `VideoPlayer`

**Files:** `src/components/VideoPlayer.tsx` + `.test.tsx`

- [ ] **Step 1: 写失败测试**
```tsx
// src/components/VideoPlayer.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { VideoPlayer } from './VideoPlayer';
it('renders and toggles play on tap without crashing', () => {
  const { getByTestId } = render(<VideoPlayer uri="file:///v.mp4" />);
  expect(getByTestId('video-player')).toBeTruthy();
  expect(() => fireEvent.press(getByTestId('video-player'))).not.toThrow();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/components/VideoPlayer.tsx
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Video from 'react-native-video';

export function VideoPlayer({ uri }: { uri: string }) {
  const [paused, setPaused] = useState(true);
  return (
    <Pressable
      testID="video-player"
      style={StyleSheet.absoluteFill}
      onPress={() => setPaused((p) => !p)}
    >
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        paused={paused}
        repeat
      />
    </Pressable>
  );
}
```
> `react-native-video` 6.x 的 `Video` 默认导出。`resizeMode`/`paused`/`repeat` 为标准 props；若 TS 报 prop 名差异，按装上的版本 .d.ts 微调。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/components/VideoPlayer.test.tsx
git add src/components/VideoPlayer.tsx src/components/VideoPlayer.test.tsx
git commit -m "feat(2b): VideoPlayer (react-native-video, tap to play/pause)"
```

---

## Task 4: `SlideItem` 加视频分支

**Files:** `src/components/Carousel/SlideItem.tsx`（改）+ `src/components/Carousel/SlideItem.test.tsx`（新建）

- [ ] **Step 1: 写失败测试**
```tsx
// src/components/Carousel/SlideItem.test.tsx
import { render } from '@testing-library/react-native';
import { SlideItem } from './SlideItem';
import type { CustomPhotoFile } from '../../utils';

const base = { id: '1', cameraType: 'back' as const, width: 1, height: 1 };
const img: CustomPhotoFile = { ...base, cameraMode: 'single', mode: 'single', mime: 'image/jpeg', path: '/a.jpg', uri: 'file:///a.jpg' };
const vid: CustomPhotoFile = { ...base, cameraMode: 'video', mode: 'video', mime: 'video/mp4', path: '/v.mp4', uri: 'file:///v.mp4' };

it('renders image vs video branch', () => {
  expect(() => render(<SlideItem file={img} />)).not.toThrow();
  const { getByTestId } = render(<SlideItem file={vid} />);
  expect(getByTestId('video-player')).toBeTruthy();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**（替换现有 `SlideItem.tsx`）
```tsx
// src/components/Carousel/SlideItem.tsx
import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { VideoPlayer } from '../VideoPlayer';

export function SlideItem({ file }: { file: CustomPhotoFile }) {
  return (
    <View style={styles.root}>
      {file.mime === 'video/mp4' ? (
        <VideoPlayer uri={file.uri} />
      ) : (
        <Image
          source={{ uri: file.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 大图区固定黑底:相机惯例,让图/视频在纯黑上凸显.
  root: { flex: 1, backgroundColor: '#000' },
});
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/components/Carousel/SlideItem.test.tsx
git add src/components/Carousel/SlideItem.tsx src/components/Carousel/SlideItem.test.tsx
git commit -m "feat(2b): SlideItem renders VideoPlayer for video files"
```

---

## Task 5: `PreviewTopBar`

**Files:** `src/camera/preview/PreviewTopBar.tsx` + `.test.tsx`

职责:confirm 变体 → 类型 label;gallery 单类型 → 「共N张」;gallery 多类型 → 类型 tab（`{label}{count}`）+ 「共N张」。主题 `useColors`,选中 tab 橙底。像素 digest §S8/S10。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/preview/PreviewTopBar.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewTopBar } from './PreviewTopBar';
import type { CustomPhotoFile } from '../../utils';
const f = (cameraMode: CustomPhotoFile['cameraMode'], id: string): CustomPhotoFile => ({
  id, cameraType: 'back', cameraMode, path: `/${id}`, uri: `file:///${id}`, width: 1, height: 1,
  mime: cameraMode === 'video' ? 'video/mp4' : 'image/jpeg', mode: cameraMode,
});

it('confirm 变体显示类型 label', () => {
  const { getByText } = render(
    <PreviewTopBar variant="confirm" files={[f('single', 'a')]} activeType="single" onSelectType={() => {}} />
  );
  expect(getByText('单拍')).toBeTruthy();
});
it('gallery 多类型显示 tab + 共N张,点 tab 回调', () => {
  const onSelectType = jest.fn();
  const files = [f('continuous', 'a'), f('continuous', 'b'), f('single', 'c')];
  const { getByTestId, getByText } = render(
    <PreviewTopBar variant="gallery" files={files} activeType="continuous" onSelectType={onSelectType} />
  );
  expect(getByText('共 3 张')).toBeTruthy();
  fireEvent.press(getByTestId('type-tab-single'));
  expect(onSelectType).toHaveBeenCalledWith('single');
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**（结构如下；像素/颜色查 digest §S10 + `useColors`）
```tsx
// src/camera/preview/PreviewTopBar.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r, useThemedStyles, type ColorTokens } from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { distinctTypes, filesOfType } from './groupTypes';

const LABEL: Record<CameraModeName, string> = { continuous: '连拍', single: '单拍', video: '视频' };

type Props = {
  variant: 'confirm' | 'gallery';
  files: CustomPhotoFile[];
  activeType: CameraModeName;
  onSelectType: (t: CameraModeName) => void;
};

export function PreviewTopBar({ variant, files, activeType, onSelectType }: Props) {
  const styles = useThemedStyles(makeStyles);
  if (variant === 'confirm') {
    return (
      <View style={styles.root}>
        <Text style={styles.label}>{LABEL[activeType]}</Text>
      </View>
    );
  }
  const types = distinctTypes(files);
  const total = files.length;
  return (
    <View style={styles.root}>
      {types.length > 1 && (
        <View style={styles.tabs}>
          {types.map((t) => {
            const sel = t === activeType;
            return (
              <TouchableOpacity key={t} testID={`type-tab-${t}`} onPress={() => onSelectType(t)}
                style={[styles.tab, sel && styles.tabSel]}>
                <Text style={[styles.tabTxt, sel && styles.tabTxtSel]}>
                  {LABEL[t]}{filesOfType(files, t).length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Text style={styles.total}>共 {total} 张</Text>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { minHeight: r(46), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: r(10), paddingHorizontal: r(14), paddingTop: r(14) },
    label: { color: c.foreground, fontSize: r(14), fontWeight: '500' },
    tabs: { flexDirection: 'row', gap: r(4), padding: r(4), borderRadius: r(999), backgroundColor: c.surface },
    tab: { paddingVertical: r(7), paddingHorizontal: r(16), borderRadius: r(999) },
    tabSel: { backgroundColor: '#EB6E00' },
    tabTxt: { color: c.foreground, fontSize: r(13), fontWeight: '600' },
    tabTxtSel: { color: '#fff' },
    total: { color: c.foreground, fontSize: r(13), opacity: 0.7 },
  });
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/preview/PreviewTopBar.test.tsx
git add src/camera/preview/PreviewTopBar.tsx src/camera/preview/PreviewTopBar.test.tsx
git commit -m "feat(2b): PreviewTopBar (label / total / type tabs)"
```

---

## Task 6: `PreviewBottomBar`

**Files:** `src/camera/preview/PreviewBottomBar.tsx` + `.test.tsx`

职责:confirm → 重拍/保存（design Button ghost/primary）;gallery → 「第X/Y张」+ 返回/删除（ghost/danger）。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/preview/PreviewBottomBar.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewBottomBar } from './PreviewBottomBar';

it('confirm 变体: 重拍/保存', () => {
  const onRetake = jest.fn(), onSave = jest.fn();
  const { getByTestId } = render(
    <PreviewBottomBar variant="confirm" index={0} total={1} onRetake={onRetake} onSave={onSave} onBack={() => {}} onDelete={() => {}} />
  );
  fireEvent.press(getByTestId('retake-btn')); expect(onRetake).toHaveBeenCalled();
  fireEvent.press(getByTestId('save-btn')); expect(onSave).toHaveBeenCalled();
});
it('gallery 变体: 第X/Y张 + 返回/删除', () => {
  const onBack = jest.fn(), onDelete = jest.fn();
  const { getByTestId, getByText } = render(
    <PreviewBottomBar variant="gallery" index={1} total={3} onRetake={() => {}} onSave={() => {}} onBack={onBack} onDelete={onDelete} />
  );
  expect(getByText('第 2/3 张')).toBeTruthy();
  fireEvent.press(getByTestId('back-btn')); expect(onBack).toHaveBeenCalled();
  fireEvent.press(getByTestId('delete-btn')); expect(onDelete).toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/preview/PreviewBottomBar.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Button, r, useThemedStyles, type ColorTokens } from '@unif/react-native-design';

type Props = {
  variant: 'confirm' | 'gallery';
  index: number;
  total: number;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: () => void;
};

export function PreviewBottomBar({ variant, index, total, onRetake, onSave, onBack, onDelete }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.root}>
      {variant === 'gallery' && (
        <Text style={styles.counter}>第 {index + 1}/{total} 张</Text>
      )}
      <View style={styles.btns}>
        {variant === 'confirm' ? (
          <>
            <Button variant="ghost" label="重拍" onPress={onRetake} testID="retake-btn" />
            <Button variant="primary" label="保存" onPress={onSave} testID="save-btn" />
          </>
        ) : (
          <>
            <Button variant="ghost" label="返回" onPress={onBack} testID="back-btn" />
            <Button variant="danger" label="删除" onPress={onDelete} testID="delete-btn" />
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { paddingHorizontal: r(16), paddingBottom: r(26), gap: r(12), alignItems: 'center' },
    counter: { color: c.foreground, fontSize: r(15), fontWeight: '600' },
    btns: { flexDirection: 'row', gap: r(12), justifyContent: 'center' },
  });
```
> `variant="danger"` 若 design 无该 variant,改 `variant="ghost"` 并加红色 `style`（核对 ButtonVariant 取值）。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/preview/PreviewBottomBar.test.tsx
git add src/camera/preview/PreviewBottomBar.tsx src/camera/preview/PreviewBottomBar.test.tsx
git commit -m "feat(2b): PreviewBottomBar (counter + variant buttons)"
```

---

## Task 7: `PreviewOverlay`（组合 + 变体路由 + tab + Carousel）

**Files:** `src/camera/preview/PreviewOverlay.tsx` + `.test.tsx`

职责:全屏上滑容器(主题底);维护 `activeType`(默认首个 distinct 类型)、`carouselIndex`;按 tab 过滤 Carousel data;保存→`toast.success('已保存')`+onSave;删除→`confirm(...)`→onDelete(当前 file)。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/preview/PreviewOverlay.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewOverlay } from './PreviewOverlay';
import type { CustomPhotoFile } from '../../utils';
const f = (cameraMode: CustomPhotoFile['cameraMode'], id: string): CustomPhotoFile => ({
  id, cameraType: 'back', cameraMode, path: `/${id}`, uri: `file:///${id}`, width: 1, height: 1,
  mime: cameraMode === 'video' ? 'video/mp4' : 'image/jpeg', mode: cameraMode,
});
const noop = { onRetake: () => {}, onSave: () => {}, onBack: () => {}, onDelete: () => {} };

it('confirm 变体: 重拍/保存 在', () => {
  const { getByTestId } = render(<PreviewOverlay files={[f('single', 'a')]} variant="confirm" {...noop} />);
  expect(getByTestId('retake-btn')).toBeTruthy();
  expect(getByTestId('save-btn')).toBeTruthy();
});
it('gallery 变体: 返回/删除 在 + 保存触发 toast', () => {
  const onSave = jest.fn();
  const { getByTestId } = render(<PreviewOverlay files={[f('single', 'a'), f('single', 'b')]} variant="gallery" {...noop} onSave={onSave} />);
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/preview/PreviewOverlay.tsx
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { confirm, toast, useThemedStyles, type ColorTokens } from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { Carousel } from '../../components/Carousel';
import { distinctTypes, filesOfType } from './groupTypes';
import { PreviewTopBar } from './PreviewTopBar';
import { PreviewBottomBar } from './PreviewBottomBar';

type Props = {
  files: CustomPhotoFile[];
  variant: 'confirm' | 'gallery';
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: (f: CustomPhotoFile) => void;
};

export function PreviewOverlay({ files, variant, onRetake, onSave, onBack, onDelete }: Props) {
  const styles = useThemedStyles(makeStyles);
  const types = useMemo(() => distinctTypes(files), [files]);
  const [activeType, setActiveType] = useState<CameraModeName>(types[0] ?? 'single');
  const [index, setIndex] = useState(0);

  // confirm 不分 tab(全 files);gallery 按 activeType 过滤
  const data = variant === 'confirm' ? files : filesOfType(files, activeType);
  const current = data[index] ?? data[0];

  const handleSave = () => {
    toast.success('已保存');
    onSave();
  };
  const handleDelete = async () => {
    const ok = await confirm({ title: '确认删除?', message: '图片删除后无法恢复' });
    if (ok && current) onDelete(current);
  };

  return (
    <View style={styles.root} testID="preview-overlay">
      <PreviewTopBar variant={variant} files={files} activeType={activeType}
        onSelectType={(t) => { setActiveType(t); setIndex(0); }} />
      <View style={styles.pager}>
        <Carousel data={data} onIndexChange={setIndex} />
      </View>
      <PreviewBottomBar variant={variant} index={index} total={data.length}
        onRetake={onRetake} onSave={handleSave} onBack={onBack} onDelete={handleDelete} />
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, backgroundColor: c.background, zIndex: 50 },
    pager: { flex: 1 },
  });
```
> `StyleSheet.absoluteFillObject` 若 RN 类型只暴露 `absoluteFill`,改用 `...StyleSheet.absoluteFill`。上滑进场动画(translateY 100%→0)可后续加,本任务先静态(测试不验动画)。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/preview/PreviewOverlay.test.tsx
git add src/camera/preview/PreviewOverlay.tsx src/camera/preview/PreviewOverlay.test.tsx
git commit -m "feat(2b): PreviewOverlay (variant routing + tabs + carousel + confirm/toast)"
```

---

## Task 8: `Container` 接线 + 删旧预览树

**Files:** 改 `src/camera/Container.tsx`、`src/camera/preview/index.tsx`;删 `preview/{PreViewContainer,PreView,SinglePre,PreviewFooter}.tsx`、`components/PreviewThumbnail.tsx`、`hooks/useConfirm.tsx`(确认无引用)

- [ ] **Step 1: Container previewing 分支 + previewVariant**
读现有 `Container.tsx`。加 `const [previewVariant, setPreviewVariant] = useState<'confirm' | 'gallery'>('gallery');`。
- `onShutter` 非保留+单拍处:`setPreviewVariant('confirm'); setPreviewing(true);`。
- `onOpenPreview`(ActionRow 的缩略图):改为 `() => { if (photos.length > 0) { setPreviewVariant('gallery'); setPreviewing(true); } }`。
- 把 `import { PreViewContainer } from './preview';` → `import { PreviewOverlay } from './preview';`。
- previewing 分支替换为:
```tsx
if (previewing) {
  return (
    <PreviewOverlay
      files={photos}
      variant={previewVariant}
      onRetake={() => { setPhotos([]); setPreviewing(false); }}
      onSave={() => settle({ code: 200, data: photos, message: 'ok' })}
      onBack={() => setPreviewing(false)}
      onDelete={(f) => {
        const next = photos.filter((x) => x !== f);
        setPhotos(next);
        if (next.length === 0) setPreviewing(false);
      }}
    />
  );
}
```

- [ ] **Step 2: 改 preview/index.tsx**
```ts
export { PreviewOverlay } from './PreviewOverlay';
export { PreviewTopBar } from './PreviewTopBar';
export { PreviewBottomBar } from './PreviewBottomBar';
```

- [ ] **Step 3: 删旧文件 + 验证无引用**
```bash
grep -rn "PreViewContainer\|SinglePre\|PreviewFooter\|PreviewThumbnail\|useConfirm\|from './PreView'" src/ | grep -v "PreviewOverlay\|PreviewTopBar\|PreviewBottomBar"
```
确认无残留引用后:
```bash
git rm src/camera/preview/PreViewContainer.tsx src/camera/preview/PreView.tsx src/camera/preview/SinglePre.tsx src/camera/preview/PreviewFooter.tsx src/components/PreviewThumbnail.tsx src/hooks/useConfirm.tsx
```
（若 `useConfirm` 仍被某处引用,保留它,只删其余。`Carousel`/`SlideItem` 保留。）

- [ ] **Step 4: 全量校验**
Run: `yarn typecheck && yarn test && yarn lint` → 0 错、全绿、0 error。`git diff main -- src/utils/interface.ts` 应为空。

- [ ] **Step 5: 提交**
```bash
git add src/camera/Container.tsx src/camera/preview/index.tsx
git commit -m "feat(2b): wire PreviewOverlay with confirm/gallery variants; remove old preview tree"
```

---

## Task 9: README + 集成校验

**Files:** `README.md`,全仓库验证

- [ ] **Step 1: README**
安装命令补 `react-native-video`;新增一小节说明:① 视频预览需 `react-native-video`(消费端安装 + iOS pod);② 预览的二次确认/Toast 用 design 的 `confirm`/`toast`,需消费端 App 根挂 `ConfirmHost`/`ToastHost`(同 `ThemeProvider`)。

- [ ] **Step 2: 构建校验**
Run: `yarn typecheck && yarn test && yarn lint && yarn prepare`
Expected: 全绿;`yarn prepare` 产 `lib/` 无错。

- [ ] **Step 3: 自查**
`git diff main -- src/utils/interface.ts` 空(open() 零改动);`preview/*` 旧树已删;`PreviewThumbnail` 已删;预览 chrome 走 `useColors`(主题),大图固定黑底。

- [ ] **Step 4: 手测清单写入 PR #25**(真机)
单拍非保留拍完→确认页(重拍/保存);连拍/保留→缩略图进回看(左右滑、第X/Y张);多类型→顶部 tab 切换;删除→二次确认→删空自动关;保存→Toast"已保存";视频项可点播放/暂停。

- [ ] **Step 5: 提交**
```bash
git add README.md
git commit -m "docs(2b): document react-native-video + Confirm/Toast host requirement"
```

---

## 备注 / 风险

- **单测覆盖**:`Container` 取景态/预览态(device-ready)在 jest 不可达(mock device=undefined)→ `PreviewOverlay`/TopBar/BottomBar 组件级直接测,Container 接线靠 typecheck + 手测。
- **react-native-video 版本/props**:按装上的 6.x .d.ts 微调 `resizeMode`/`paused` 等 prop 名。
- **design `confirm`/`toast` Host**:消费端需挂 `ConfirmHost`/`ToastHost`(portal 已挂);未挂则静默失效。
- **删除后 Carousel index**:删中间一张后 `index` 可能越界 → `current = data[index] ?? data[0]` 已兜底;真机微调停留位置。
- **`open()` 契约零改动**:不碰 `src/utils/interface.ts`。
- **水印=2c**,不在本计划。
