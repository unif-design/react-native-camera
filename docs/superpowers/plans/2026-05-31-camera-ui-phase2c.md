# 相机 UI Phase 2c — 水印 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（全程 opus + max）逐任务执行。步骤用 `- [ ]` 跟踪。

**Goal:** 给相机加水印——取景器显示戳记提示，**保存时**把水印烧进要返回的照片（Skia 全分辨率离屏合成），`open()` 加回 `watermark` 入参。

**Architecture:** `OpenConfig.watermark?: WatermarkType`；`layout.ts` 纯函数算排版（overlay 与 burn 共用）；`WatermarkStamp`(View) 取景提示；`burnWatermark`(Skia + react-native-fs) 离屏合成；`Container` 在 `handleSave` 烧图 + 处理中 Loading。水印=可视记录，**不防篡改**。

**Tech Stack:** TS / RN 0.85 / `@shopify/react-native-skia`(新)/ `react-native-fs`(新声明)/ jest 29。

**Spec:** `docs/superpowers/specs/2026-05-31-camera-ui-phase2c-watermark-design.md`。**分支：** `feat/camera-ui-phase2c-watermark`（off main 2.7.0）。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `package.json` | skia + fs peer+dev | 改 |
| `jest.setup.ts` | mock skia + fs | 改 |
| `src/utils/interface.ts` | `WatermarkType` + `OpenConfig.watermark?` | 改 |
| `src/camera/watermark/layout.ts` | 纯函数:position→align/anchor + 比例尺寸 | 新建 |
| `src/camera/watermark/WatermarkStamp.tsx` | 取景戳记(View,自适应对齐) | 新建 |
| `src/camera/watermark/burnWatermark.ts` | Skia 离屏合成→新 file(fs 写,兜底原图) | 新建 |
| `src/camera/watermark/index.tsx` | 导出 | 新建 |
| `src/camera/Container.tsx` | 渲染 stamp + handleSave 烧图 + burning Loading | 改 |
| `README.md` | skia/fs 安装 + 水印说明 | 改 |

> design 组件在测试中 passthrough；新组件用 RN 原语 + `DARK` 常量（取景叠加固定深色）。

---

## Task 1: 依赖 + jest mock

**Files:** `package.json`, `jest.setup.ts`

- [ ] **Step 1: 装依赖**
```bash
yarn add -D @shopify/react-native-skia react-native-fs
```
`package.json` 把两者加进 `peerDependencies`（skia `>=1`、fs `>=2`，对齐装上的 major）。

- [ ] **Step 2: jest mock**（`jest.setup.ts` 末尾追加）
```ts
jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  readFile: jest.fn().mockResolvedValue('BASE64DATA'),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@shopify/react-native-skia', () => {
  const mkImage = { width: () => 1080, height: () => 1440 };
  const mkCanvas = { drawImage: jest.fn(), drawText: jest.fn() };
  const mkSnapshot = { encodeToBase64: jest.fn(() => 'OUTBASE64') };
  const mkSurface = { getCanvas: () => mkCanvas, makeImageSnapshot: () => mkSnapshot };
  return {
    Skia: {
      Data: { fromBase64: jest.fn(() => ({})) },
      Image: { MakeImageFromEncoded: jest.fn(() => mkImage) },
      Surface: { MakeOffscreen: jest.fn(() => mkSurface) },
      Font: jest.fn(() => ({ getTextWidth: () => 100, measureText: () => ({ width: 100 }) })),
      Paint: jest.fn(() => ({ setColor: jest.fn() })),
      Color: jest.fn(() => 0),
    },
    ImageFormat: { JPEG: 3 },
  };
});
```

- [ ] **Step 3: 验证** `yarn typecheck && yarn test` → 0 错、全绿（lock 已更新）。

- [ ] **Step 4: 提交**
```bash
git add package.json yarn.lock jest.setup.ts
git commit -m "build(2c): add react-native-skia + react-native-fs deps and jest mocks"
```

---

## Task 2: `WatermarkType` + `OpenConfig.watermark`

**Files:** `src/utils/interface.ts` + `src/__tests__/types.test.tsx`（追加）

- [ ] **Step 1: 写失败测试**（在 `types.test.tsx` 追加）
```tsx
import type { WatermarkType, OpenConfig } from '../utils';
it('WatermarkType + OpenConfig.watermark', () => {
  const wm: WatermarkType = { content: ['Unif · 拜访记录', '上海'], position: 'top-right' };
  const cfg: OpenConfig = { cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear', watermark: wm };
  expect(cfg.watermark?.content.length).toBe(2);
  const noWm: OpenConfig = { cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' };
  expect(noWm.watermark).toBeUndefined();
});
```

- [ ] **Step 2: 跑确认失败** → `yarn jest src/__tests__/types.test.tsx`

- [ ] **Step 3: 实现**（`interface.ts`）
```ts
export type WatermarkType = {
  /** 水印文字,每行一条;数量不限,消费者可自由增减 */
  content: string[];
  /** 位置,缺省 'top-right' */
  position?:
    | 'top-left' | 'top-center' | 'top-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';
};
```
并在 `OpenConfig` 加 `watermark?: WatermarkType;`（其余字段不动）。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/__tests__/types.test.tsx
git add src/utils/interface.ts src/__tests__/types.test.tsx
git commit -m "feat(2c): re-add WatermarkType and OpenConfig.watermark"
```

---

## Task 3: `layout.ts`（排版纯函数）

**Files:** `src/camera/watermark/layout.ts` + `.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
import { computeWatermarkLayout } from './layout';

it('position → align/anchor', () => {
  expect(computeWatermarkLayout(390, { content: ['a'] }).align).toBe('right'); // 缺省 top-right
  expect(computeWatermarkLayout(390, { content: ['a'], position: 'top-left' }).align).toBe('left');
  expect(computeWatermarkLayout(390, { content: ['a'], position: 'bottom-center' })).toMatchObject({ align: 'center', anchorY: 'bottom' });
  expect(computeWatermarkLayout(390, { content: ['a'], position: 'bottom-right' }).anchorY).toBe('bottom');
});
it('字号/padding 随宽缩放', () => {
  const a = computeWatermarkLayout(390, { content: ['a'] });
  const b = computeWatermarkLayout(1080, { content: ['a'] });
  expect(b.fontSize).toBeGreaterThan(a.fontSize);
  expect(a.content).toEqual(['a']);
  expect(a.maxWidth).toBeLessThan(390);
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```ts
// src/camera/watermark/layout.ts
import type { WatermarkType } from '../../utils';

export type WmAlign = 'left' | 'center' | 'right';
export type WmLayout = {
  content: string[];
  align: WmAlign;
  anchorY: 'top' | 'bottom';
  fontSize: number;
  lineGap: number;
  pad: number;
  maxWidth: number;
};

const POS: Record<
  NonNullable<WatermarkType['position']>,
  { align: WmAlign; anchorY: 'top' | 'bottom' }
> = {
  'top-left': { align: 'left', anchorY: 'top' },
  'top-center': { align: 'center', anchorY: 'top' },
  'top-right': { align: 'right', anchorY: 'top' },
  'bottom-left': { align: 'left', anchorY: 'bottom' },
  'bottom-center': { align: 'center', anchorY: 'bottom' },
  'bottom-right': { align: 'right', anchorY: 'bottom' },
};

// 相对目标宽度的比例(起点值,真机微调到与 digest §水印 一致)
export function computeWatermarkLayout(
  targetWidth: number,
  wm: WatermarkType
): WmLayout {
  const { align, anchorY } = POS[wm.position ?? 'top-right'];
  const fontSize = Math.round(targetWidth * 0.033);
  return {
    content: wm.content,
    align,
    anchorY,
    fontSize,
    lineGap: Math.round(fontSize * 0.45),
    pad: Math.round(targetWidth * 0.04),
    maxWidth: Math.round(targetWidth * 0.7),
  };
}
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/watermark/layout.test.ts
git add src/camera/watermark/layout.ts src/camera/watermark/layout.test.ts
git commit -m "feat(2c): watermark layout helper (position align/anchor + scaled sizing)"
```

---

## Task 4: `WatermarkStamp`（取景叠加）

**Files:** `src/camera/watermark/WatermarkStamp.tsx` + `.test.tsx`

- [ ] **Step 1: 写失败测试**
```tsx
import { render } from '@testing-library/react-native';
import { WatermarkStamp } from './WatermarkStamp';

it('renders content lines + testID', () => {
  const { getByTestId, getByText } = render(
    <WatermarkStamp watermark={{ content: ['L1', 'L2'], position: 'top-right' }} />
  );
  expect(getByTestId('watermark-stamp')).toBeTruthy();
  expect(getByText('L1')).toBeTruthy();
  expect(getByText('L2')).toBeTruthy();
});
it('no crash for center/bottom', () => {
  expect(() =>
    render(<WatermarkStamp watermark={{ content: ['x'], position: 'bottom-center' }} />)
  ).not.toThrow();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/watermark/WatermarkStamp.tsx
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { r } from '@unif/react-native-design';
import type { WatermarkType } from '../../utils';
import { DARK } from '../colors/dark';
import { computeWatermarkLayout } from './layout';

export function WatermarkStamp({ watermark }: { watermark: WatermarkType }) {
  const { width } = useWindowDimensions();
  const L = computeWatermarkLayout(width, watermark);
  const horiz =
    L.align === 'right'
      ? { right: L.pad, alignItems: 'flex-end' as const }
      : L.align === 'center'
        ? { left: 0, right: 0, alignItems: 'center' as const }
        : { left: L.pad, alignItems: 'flex-start' as const };
  const vert = L.anchorY === 'top' ? { top: L.pad } : { bottom: L.pad };
  return (
    <View
      testID="watermark-stamp"
      pointerEvents="none"
      style={[styles.root, { maxWidth: L.maxWidth }, horiz, vert]}
    >
      {watermark.content.map((line, i) => (
        <Text
          key={`${i}-${line}`}
          style={[
            styles.line,
            { fontSize: L.fontSize, textAlign: L.align },
            i === 0 && styles.title,
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 7 },
  line: { color: DARK.white, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: r(3) },
  title: { fontWeight: '600' },
});
```
> center 时 `left:0/right:0 + alignItems center`，`maxWidth` 仍限行宽 → 居中且自适应。`r` 仅用于 shadowRadius；尺寸用 layout 的像素值。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/watermark/WatermarkStamp.test.tsx
git add src/camera/watermark/WatermarkStamp.tsx src/camera/watermark/WatermarkStamp.test.tsx
git commit -m "feat(2c): WatermarkStamp viewfinder overlay (adaptive align)"
```

---

## Task 5: `burnWatermark`（Skia 离屏合成）

**Files:** `src/camera/watermark/burnWatermark.ts` + `.test.ts`, `src/camera/watermark/index.tsx`

- [ ] **Step 1: 写失败测试**
```ts
import { burnWatermark } from './burnWatermark';
import type { CustomPhotoFile, WatermarkType } from '../../utils';

const photo = (): CustomPhotoFile => ({
  id: '1', cameraType: 'back', cameraMode: 'single', path: '/a.jpg',
  uri: 'file:///a.jpg', width: 1080, height: 1440, mime: 'image/jpeg', mode: 'single',
});
const wm: WatermarkType = { content: ['L1', 'L2'], position: 'top-right' };

it('composites and returns a new path', async () => {
  const out = await burnWatermark(photo(), wm);
  expect(out.path).not.toBe('/a.jpg');
  expect(out.uri.startsWith('file://')).toBe(true);
  expect(out.id).toBe('1'); // 其余字段保留
});

it('falls back to original file on error', async () => {
  const skia = require('@shopify/react-native-skia');
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValueOnce(null); // 解码失败
  const p = photo();
  const out = await burnWatermark(p, wm);
  expect(out).toBe(p); // 兜底原图
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```ts
// src/camera/watermark/burnWatermark.ts
import RNFS from 'react-native-fs';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { CustomPhotoFile, WatermarkType } from '../../utils';
import { toFileUri } from '../../utils';
import { computeWatermarkLayout } from './layout';

export async function burnWatermark(
  file: CustomPhotoFile,
  wm: WatermarkType
): Promise<CustomPhotoFile> {
  try {
    const base64 = await RNFS.readFile(file.path, 'base64');
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
    if (!image) return file;
    const w = image.width();
    const h = image.height();
    const surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) return file;
    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0);

    const L = computeWatermarkLayout(w, wm);
    const font = Skia.Font(undefined, L.fontSize);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('white'));

    const lineH = L.fontSize + L.lineGap;
    const startY =
      L.anchorY === 'top'
        ? L.pad + L.fontSize
        : h - L.pad - (L.content.length - 1) * lineH;
    L.content.forEach((line, i) => {
      const tw =
        typeof font.getTextWidth === 'function'
          ? font.getTextWidth(line)
          : font.measureText(line).width;
      const x =
        L.align === 'left'
          ? L.pad
          : L.align === 'right'
            ? w - L.pad - tw
            : (w - tw) / 2;
      canvas.drawText(line, x, startY + i * lineH, paint, font);
    });

    const snapshot = surface.makeImageSnapshot();
    const outB64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    const outPath = `${RNFS.TemporaryDirectoryPath}/wm_${file.id}.jpg`;
    await RNFS.writeFile(outPath, outB64, 'base64');
    return { ...file, path: outPath, uri: toFileUri(outPath) };
  } catch {
    return file;
  }
}
```
`src/camera/watermark/index.tsx`：
```ts
export { WatermarkStamp } from './WatermarkStamp';
export { burnWatermark } from './burnWatermark';
export { computeWatermarkLayout } from './layout';
```
> **实现者注意**：上面的 Skia API（`Skia.Font(undefined, size)` / `getTextWidth` / `encodeToBase64(ImageFormat.JPEG, q)` / `Skia.Color`）按装上的 `@shopify/react-native-skia` 版本 .d.ts **核对微调**。核心编排（读→解码→离屏画图+文字→编码→写→换 path、异常兜底原图）不变。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/watermark/burnWatermark.test.ts
git add src/camera/watermark/burnWatermark.ts src/camera/watermark/index.tsx src/camera/watermark/burnWatermark.test.ts
git commit -m "feat(2c): burnWatermark Skia offscreen compositing with fallback"
```

---

## Task 6: `Container` 接线（取景叠加 + 保存烧图 + 处理中）

**Files:** `src/camera/Container.tsx`

先完整读 `Container.tsx`（2a/2b 后含取景态 + previewing 分支 + 两处 `onSave: () => settle({code:200,data:photos})`）。

- [ ] **Step 1: 加 state + handleSave**
在 state 区加 `const [burning, setBurning] = useState(false);`。新增：
```tsx
const handleSave = async () => {
  if (!config.watermark) {
    settle({ code: 200, data: photos, message: 'ok' });
    return;
  }
  setBurning(true);
  const out = await Promise.all(
    photos.map((p) =>
      p.mime === 'image/jpeg' ? burnWatermark(p, config.watermark!) : p
    )
  );
  settle({ code: 200, data: out, message: 'ok' });
};
```
import：`import { WatermarkStamp, burnWatermark } from './watermark';`、`import { Loading } from '../components/Loading';`(若未引)。

- [ ] **Step 2: 用 handleSave 替换两处 onSave**
取景态 `ActionRow` 的 `onSave={() => settle(...200...)}` → `onSave={handleSave}`；previewing 分支 `PreviewOverlay` 的 `onSave={() => settle(...200...)}` → `onSave={handleSave}`。

- [ ] **Step 3: 取景态渲染 WatermarkStamp + burning Loading**
device-ready return 内、取景框层加：
```tsx
{!recording && config.watermark && (
  <WatermarkStamp watermark={config.watermark} />
)}
```
（放在 Camera 之上、与 SideRail 同层；`WatermarkStamp` 自带 absolute 定位。）
return 顶层（`<View style={styles.root}>` 内最后）加处理中遮罩：
```tsx
{burning && (
  <View style={styles.burning} testID="burning">
    <Loading />
  </View>
)}
```
styles 加 `burning: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 60 }`。

- [ ] **Step 4: 校验**
`yarn typecheck && yarn test && yarn lint` → 0 错、全绿、0 error。`git diff main -- src/utils/interface.ts` 只多 `WatermarkType` + `watermark?`（无其它 open() 改动）。

- [ ] **Step 5: 提交**
```bash
git add src/camera/Container.tsx
git commit -m "feat(2c): render WatermarkStamp + burn watermark on save with busy state"
```

---

## Task 7: README + 集成校验

**Files:** `README.md`，全仓库

- [ ] **Step 1: README**
安装命令补 `@shopify/react-native-skia` + `react-native-fs`；新增小节：水印用法（`open({ ..., watermark: { content: [...], position: 'top-right' } })`）、说明"**保存时烧入成片、可视记录、不防篡改**"、消费端需装 skia/fs + iOS pod。

- [ ] **Step 2: 构建校验**
`yarn typecheck && yarn test && yarn lint && yarn prepare` → 全绿、lib/ 无错。

- [ ] **Step 3: 自查**
`git diff main -- src/utils/interface.ts` 仅 watermark 相关；`WatermarkStamp`/取景叠加用 `DARK`；预览未加水印层。

- [ ] **Step 4: 手测清单写入 PR**（真机）
传 `watermark.content` 多行；取景右上/各 position 显戳记且右侧右对齐自适应；单拍/连拍保存后成片**带水印**（全分辨率）；保存时"处理中"；视频不带；不传 watermark 无戳记无烧图；烧图失败仍返原图。

- [ ] **Step 5: 提交**
```bash
git add README.md
git commit -m "docs(2c): document watermark usage + skia/fs deps"
```

---

## 备注 / 风险

- **Skia API**：按装上版本核对 `Skia.Font`/`getTextWidth`/`encodeToBase64`/`ImageFormat` 的精确签名。
- **skia 新架构/RN 0.85 兼容**：Task 1 装时确认。
- **Container device-ready/handleSave** jest 不可达（mock device=undefined）→ typecheck + 手测；烧图编排的纯逻辑已由 `burnWatermark` 单测覆盖。
- **多张大图烧图耗时**：`Promise.all` 并行；真机看是否需串行/进度。
- **临时文件清理**：水印临时文件留 `TemporaryDirectoryPath`，系统回收；如需主动清可后续。
- **open() 契约**：仅加 `watermark?`，其余零改动。
- 水印=可视记录，**不防篡改**（独立课题）。
