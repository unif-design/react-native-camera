# 相机拍照体验优化 + 向 design 看齐 + 工程规范化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 全程用 opus(max effort)subagent。

**Goal:** 修复 7 项拍照体验问题,并把图标/暗色主题全面归位 design、清理 `@gorhom/bottom-sheet` 过时依赖、测试统一到 `src/__tests__/`、文档全量更新。

**Architecture:** 双仓库。Phase A 在 `@unif/react-native-design` 走 PR 新增 `sound-off` 图标并发版;Phase B 在 `@unif/react-native-camera` 完成依赖现代化 + UI 优化 + 暗色主题迁移 + 测试规范化 + 文档。相机弹窗改为相机 Modal 内自带本地实现,不再依赖 App 根 host。

**Tech Stack:** RN 0.85 新架构、React 19、TS 6、vision-camera 5.x、@unif/react-native-design(theme/Icon/Button)、jest + @react-native/jest-preset。

**源 spec:** `docs/superpowers/specs/2026-06-08-camera-ux-and-design-alignment-design.md`

---

## 执行顺序与依赖

| 顺序 | Task | spec 项 | 主要文件 | 依赖 |
|---|---|---|---|---|
| 1 | A1 design sound-off | Phase A | design 仓库 | 无(发版需用户) |
| 2 | B0 依赖现代化 | B0 | package.json / example / jest.setup | 无 |
| 3 | B6 删网格 | B6 | SideRail / Camera / Container | B0 |
| 4 | B2 比例改文字 | B2 | SideRail | B6 |
| 5 | B5 0.5x 超广角 | B5 | Container | B0 |
| 6 | B1 取景整屏居中 | B1 | Container / Camera | B6 |
| 7 | B4+B7 本地弹窗 | B4/B7 | 新增 CameraDialogHost + ModalView/Container/PreviewOverlay | B1 |
| 8 | B8 暗色主题 token | B8 | ModalView + 全组件 + colors/dark.ts | B1/B4 |
| 9 | B3 静音图标接入 | B3 | SideRail / 删 VolumeIcon | **A1 发版** + B2 |
| 10 | B9 测试收口 | B9 | src/__tests__/ | B1–B8 |
| 11 | B10 文档 + llms | B10 | CLAUDE/README/AGENTS/website | 全部 |

> 串行执行(subagent-driven 本就一次一个 Task + review),多个 Task 改 `Container.tsx`/`SideRail.tsx`,顺序避免冲突。
> camera 改动统一在新分支 `feat/camera-ux-and-design-alignment`(执行前由主控创建)。

---

## Task A1: design 新增 `sound-off` 图标(Phase A)

**仓库:** `/Users/liulijun/tongyi/unif/react-native-design`

**Files:**
- Create: `src/icons/svg/sound-off.svg`
- Regenerate: `src/icons/data.ts`(由脚本生成,勿手改)

- [ ] **Step 1: 新建分支**

```bash
cd /Users/liulijun/tongyi/unif/react-native-design
git checkout -b feat/add-sound-off-icon
```

- [ ] **Step 2: 写 sound-off.svg**(喇叭沿用 `sound`,右侧完整 ✕,viewBox 安全区内)

Create `src/icons/svg/sound-off.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"></path><path d="M16 9l5 6"></path><path d="M21 9l-5 6"></path></svg>
```

- [ ] **Step 3: 生成 data.ts**

Run: `node scripts/build-icons.js`
Expected: 无报错;`grep "'sound-off'" src/icons/data.ts` 命中(类型联合 + map 各一处)。

- [ ] **Step 4: 校验**

Run: `yarn typecheck && yarn lint`
Expected: PASS(`IconName` 含 `'sound-off'`)。

- [ ] **Step 5: 构建 lib**

Run: `yarn prepare`
Expected: bob build 成功。

- [ ] **Step 6: Commit + push + PR**

```bash
git add src/icons/svg/sound-off.svg src/icons/data.ts
git commit -m "feat(icons): add sound-off (muted speaker) icon"
git push -u origin feat/add-sound-off-icon
gh pr create --fill
```
合并由用户操作(或授权后 `gh pr merge --squash --delete-branch`);合并后用户 `yarn release` 发版。**把发布版本号回填到 spec 与本 plan 的 B0/B3。**

---

## Task B0: 依赖现代化(去 bottom-sheet / 升 design)

**Files:**
- Modify: `package.json`(peer L120 区、dev L76 区)
- Modify: `example/package.json`(L13 区)
- Modify: `jest.setup.ts`(L114 区)

- [ ] **Step 1: 移除 camera 的 bottom-sheet 声明 + 升 design**

`package.json`:
- `peerDependencies`:删 `"@gorhom/bottom-sheet": ">=5"`;`"@unif/react-native-design"` 改 `">=0.7.0"`(去 bottom-sheet 需 design ≥0.6;sound-off 版本在 B3 再提)。
- `devDependencies`:删 `"@gorhom/bottom-sheet": "^5.2.14"`;`"@unif/react-native-design"` 改 `"0.7.0"`。

- [ ] **Step 2: example 同步**

`example/package.json`:删 `"@gorhom/bottom-sheet": "^5.2.14"`;`"@unif/react-native-design"` 升 `"0.7.0"`(若声明)。

- [ ] **Step 3: 删 jest 的 BottomSheet mock**

`jest.setup.ts` L114 区:删除 `BottomSheet: passthrough,`(及无用的相关 mock 行)。design 0.7 confirm 用纯 RN Modal,不需要。

- [ ] **Step 4: 安装 + 验证**

Run:
```bash
yarn
yarn typecheck && yarn lint && yarn test
```
Expected: 安装成功;无 `@gorhom` 解析;**若 design 0.5→0.7 有其它 API 变化导致挂,在此 Task 一并适配**(`Icon`/`useColors`/`Button`/`confirm`/`toast` 等)。

- [ ] **Step 5: Commit**

```bash
git add package.json example/package.json jest.setup.ts yarn.lock
git commit -m "chore(deps): drop @gorhom/bottom-sheet, bump @unif/react-native-design to 0.7.0"
```

---

## Task B6: 删除网格(点6)

**Files:**
- Modify: `src/camera/setup/SideRail.tsx`(删 grid 按钮 + props)
- Modify: `src/camera/Camera.tsx`(删 GridOverlay + grid prop + Svg/Line import)
- Modify: `src/camera/Container.tsx`(删 grid state / 传参)
- Modify: `src/camera/setup/SideRail.test.tsx`、`src/camera/Camera.test.tsx`(若有 grid 断言)

- [ ] **Step 1: 改 SideRail**

`SideRail.tsx`:从 `Props` 删 `grid`、`onToggleGrid`;删整个 `grid-btn` 的 `<TouchableOpacity>`(含 `Icon name="grid"`);删函数签名解构里的 `grid` / `onToggleGrid`。

- [ ] **Step 2: 改 Camera**

`Camera.tsx`:从 `Props` 删 `grid?`;删函数解构里的 `grid`;删 `{grid && <GridOverlay />}`;删 `GridOverlay` 函数定义;删顶部 `import Svg, { Line } from 'react-native-svg';`(确认无其它用处)。

- [ ] **Step 3: 改 Container**

`Container.tsx`:删 `const [grid, setGrid] = useState(false);`;删传给 `<Camera grid={grid} />`、`<SideRail grid={grid} onToggleGrid={...} />` 的 grid 相关 props。

- [ ] **Step 4: 改测试**

去掉 `SideRail.test.tsx` / `Camera.test.tsx` 里 grid 按钮 / GridOverlay 的断言与渲染。

- [ ] **Step 5: 验证 + Commit**

Run: `yarn typecheck && yarn lint && yarn test src/camera/setup/SideRail.test.tsx src/camera/Camera.test.tsx`
Expected: PASS。
```bash
git add src/camera/setup/SideRail.tsx src/camera/Camera.tsx src/camera/Container.tsx src/camera/setup/SideRail.test.tsx src/camera/Camera.test.tsx
git commit -m "feat(camera): remove grid overlay and its toggle"
```

---

## Task B2: 比例切换改文字(点2)

**Files:**
- Modify: `src/camera/setup/SideRail.tsx`
- Modify: `src/camera/setup/SideRail.test.tsx`

- [ ] **Step 1: 改测试(TDD)**

`SideRail.test.tsx`:断言比例按钮渲染文字 `4:3`(默认)且点击后回调切到 `16:9`。示例:
```tsx
const { getByTestId, getByText } = render(<SideRail {...baseProps} aspectRatio="4:3" />);
expect(getByText('4:3')).toBeTruthy();
fireEvent.press(getByTestId('aspect-btn'));
expect(onChangeAspectRatio).toHaveBeenCalledWith('16:9');
```

- [ ] **Step 2: 跑测试看失败**

Run: `yarn test src/camera/setup/SideRail.test.tsx -t aspect`
Expected: FAIL(当前是 Icon 不是文字)。

- [ ] **Step 3: 改实现**

`SideRail.tsx`:把 `aspect-btn` 里的 `<Icon name={aspectRatio==='4:3'?'aspect-4-3':'aspect-16-9'} .../>` 换成 `<Text style={styles.aspectTxt}>{aspectRatio}</Text>`;新增 `aspectTxt` 样式(白色、字重 600、字号 `r(13)` 左右,颜色用 design token,见 B8 会统一)。

- [ ] **Step 4: 验证 + Commit**

Run: `yarn test src/camera/setup/SideRail.test.tsx && yarn typecheck && yarn lint`
```bash
git add src/camera/setup/SideRail.tsx src/camera/setup/SideRail.test.tsx
git commit -m "feat(camera): aspect ratio toggle shows text 4:3 / 16:9"
```

---

## Task B5: 启用 0.5x 超广角(点5)

**Files:**
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 改设备请求**

`Container.tsx`:`useCameraDevice(position, { physicalDevices: ['wide-angle'] })` → `{ physicalDevices: ['ultra-wide-angle', 'wide-angle'] }`。更新该行上方注释(说明启用超广角以支持 0.5x,真机需验证 iOS #3773)。

- [ ] **Step 2: 验证**

Run: `yarn typecheck && yarn lint && yarn test src/camera/footer/ZoomChips.test.tsx`
Expected: PASS(`ZoomChips` 已有 0.5 档逻辑;若该测试未覆盖 minZoom≤0.5 出现 0.5 档,补一条)。

- [ ] **Step 3: Commit**

```bash
git add src/camera/Container.tsx src/camera/footer/ZoomChips.test.tsx
git commit -m "feat(camera): enable ultra-wide so 0.5x zoom chip appears"
```
> 真机验证(用户):前后摄切换 + 0.5x 不触发 #3773。

---

## Task B1: 取景画面整屏居中(点1)

**Files:**
- Modify: `src/camera/Container.tsx`(布局重构:viewport 铺满 root、footer/sideRail/zoomChips 浮层)
- Modify: `src/camera/Camera.tsx`(取景框整屏居中)

- [ ] **Step 1: Camera 取景框整屏居中**

`Camera.tsx` `styles`:`root` 保持 `flex:1` + 居中 + 黑底;确认 `frame` 仍 `width:'100%'` + `aspectRatio`。Camera 会铺满父容器(B1 让父容器=整屏),故取景框相对整屏居中。无需大改,确保 `root` 用 `StyleSheet.absoluteFill` 或 `flex:1` 能撑满父。

- [ ] **Step 2: Container 布局重构**

`Container.tsx` `styles` 与 JSX:
- `viewport` 从 `flex:1` 改为铺满整个 `root`:用 `...StyleSheet.absoluteFill`(或 `root` 内 `viewport flex:1` 且把 `bottom` 改 absolute)。目标:取景器占满整屏,取景框整屏垂直居中。
- `bottom`(footer)从 column 流改为 `position:'absolute', left:0, right:0, bottom:0`,叠在取景上;加半透明保护底(`backgroundColor` 用 design `scrim`/`sheetBackdrop` 衍生的半透明黑,或物理常量 `rgba(0,0,0,0.35)`,B8 统一)。保留 `paddingBottom: insets.bottom + r(20)`。
- `sideRail`、`zoomChips` 的 `bottom` 参照值上移到 footer 之上(`bottom: footer 估高 + 间距`,如 `r(140)`;真机微调)。
- 渲染顺序:Camera 最底,然后 watermark / sideRail / zoomChips / CaptureFlash,footer 浮层最上。

- [ ] **Step 3: 验证(渲染冒烟)**

Run: `yarn typecheck && yarn lint && yarn test src/__tests__/viewfinder.test.tsx`
Expected: PASS(若 viewfinder 测试断言布局,更新为新结构;否则确保 `device-ready` 仍渲染)。

- [ ] **Step 4: Commit**

```bash
git add src/camera/Container.tsx src/camera/Camera.tsx src/__tests__/viewfinder.test.tsx
git commit -m "feat(camera): center viewfinder on full screen, float controls over preview"
```
> 真机验证(用户):4:3 / 16:9 居中观感 + footer 浮层遮挡可接受。

---

## Task B4+B7: 相机内本地弹窗 + toast(点4 + 点7)

**Files:**
- Create: `src/camera/ui/CameraDialogHost.tsx`(Provider + 本地 confirm sheet + 本地 toast + `useCameraDialog`)
- Create: `src/__tests__/camera/ui/CameraDialogHost.test.tsx`
- Modify: `src/camera/ModalView.tsx`(挂 Provider)
- Modify: `src/camera/Container.tsx`(用 `useCameraDialog().confirm`)
- Modify: `src/camera/preview/PreviewOverlay.tsx`(用 `useCameraDialog().confirm`/`toast`)

- [ ] **Step 1: 写测试(TDD)**

`src/__tests__/camera/ui/CameraDialogHost.test.tsx`:
```tsx
// confirm: 调用后渲染标题/消息 + 确认/取消按钮;点确认 resolve(true),点取消 resolve(false)
// toast: 调用后渲染文案
```
用一个测试宿主组件挂 `<CameraDialogProvider>` 并通过 `useCameraDialog()` 触发 `confirm`/`toast`,断言渲染与 resolve。

- [ ] **Step 2: 跑测试看失败**

Run: `yarn test src/__tests__/camera/ui/CameraDialogHost.test.tsx`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 CameraDialogHost**

`src/camera/ui/CameraDialogHost.tsx` 核心:
```tsx
import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Button, useColors } from '@unif/react-native-design';

type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Ctx = { confirm: (o: ConfirmOpts) => Promise<boolean>; toast: (msg: string) => void };
const DialogCtx = createContext<Ctx | null>(null);
export const useCameraDialog = () => {
  const c = useContext(DialogCtx);
  if (!c) throw new Error('useCameraDialog must be used within CameraDialogProvider');
  return c;
};

export function CameraDialogProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const [entry, setEntry] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setEntry({ ...o, resolve })), []);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2000);
  }, []);
  const close = (b: boolean) => { entry?.resolve(b); setEntry(null); };

  return (
    <DialogCtx.Provider value={{ confirm, toast }}>
      {children}
      {entry && (
        <View style={styles.overlay} testID="camera-confirm">
          <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={() => close(false)} />
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.title, { color: c.foreground }]}>{entry.title}</Text>
            {entry.message ? <Text style={[styles.msg, { color: c.foregroundMuted }]}>{entry.message}</Text> : null}
            <View style={styles.actions}>
              <Button label={entry.cancelLabel ?? '取消'} variant="secondary" block onPress={() => close(false)} testID="camera-confirm-cancel" />
              <Button label={entry.confirmLabel ?? '确认'} variant={entry.destructive ? 'danger' : 'primary'} block onPress={() => close(true)} testID="camera-confirm-ok" />
            </View>
          </View>
        </View>
      )}
      {toastMsg && (
        <View style={styles.toastWrap} pointerEvents="none" testID="camera-toast">
          <Text style={[styles.toast, { color: c.onSurface ?? '#fff', backgroundColor: c.inverseSurface ?? 'rgba(0,0,0,0.85)' }]}>{toastMsg}</Text>
        </View>
      )}
    </DialogCtx.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  msg: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center', zIndex: 101 },
  toast: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, overflow: 'hidden', fontSize: 14 },
});
```
> 用 design `Button` + dark token;非 RN Modal(已在相机 Modal 内,用 absolute overlay)。`r()` 缩放按 B8 统一时套用。

- [ ] **Step 4: 跑测试看通过**

Run: `yarn test src/__tests__/camera/ui/CameraDialogHost.test.tsx`
Expected: PASS。

- [ ] **Step 5: ModalView 挂 Provider**

`ModalView.tsx`:在 `<ThemeProvider>` 内包 `<CameraDialogProvider>{children}</CameraDialogProvider>`。

- [ ] **Step 6: Container / PreviewOverlay 切到本地弹窗**

- `Container.tsx`:删 `import { confirm, r } from '@unif/react-native-design'` 里的 `confirm`(保留 `r`);`onSelectMode`/`handleCancel` 改用 `const { confirm } = useCameraDialog();`。
- `PreviewOverlay.tsx`:删 `import { confirm, toast } from '@unif/react-native-design'`;改 `const { confirm, toast } = useCameraDialog();`(toast 用法从 `toast.success('已保存')` 改为 `toast('已保存')`)。

- [ ] **Step 7: 验证 + Commit**

Run: `yarn typecheck && yarn lint && yarn test src/__tests__/camera/ui/CameraDialogHost.test.tsx src/camera/preview/PreviewOverlay.test.tsx`
```bash
git add src/camera/ui/CameraDialogHost.tsx src/__tests__/camera/ui/CameraDialogHost.test.tsx src/camera/ModalView.tsx src/camera/Container.tsx src/camera/preview/PreviewOverlay.tsx
git commit -m "feat(camera): in-modal local confirm/toast so dialogs aren't hidden behind camera Modal"
```

---

## Task B8: 暗色主题归位 design token(务实迁移)

**Files:**
- Modify: `src/camera/ModalView.tsx`(`forceScheme="dark"`)
- Modify: `src/camera/colors/dark.ts`(精简为物理常量 + 注释)
- Modify: 所有 import `DARK` 的组件(SideRail / SideActions / Container / Camera / ZoomChips / preview/* / footer/* / watermark/* 等)

**颜色映射表**(`DARK.x` → 替换):

| 原 | 替换 |
|---|---|
| `DARK.white` `#fff` | `c.foreground` |
| `DARK.white95` | `c.foreground`(纯白近似) |
| `DARK.white65` / `white40` | `c.foregroundMuted` / `c.foregroundSubtle` |
| `DARK.white25` | `c.glassHighlight` |
| `DARK.white12` | `c.glassPillBorder` |
| `DARK.white08` | `c.glassSeparator` |
| `DARK.orange` / `orange95` | `c.primary` |
| `DARK.orange16` / `orange18` | `c.primaryContainer`(近似;不合适则保留物理常量) |
| `DARK.black` `#000`(取景/Modal 底) | **物理常量保留** `VIEWFINDER.black` |
| `DARK.black42` / `black45`(玻璃药丸底) | **物理常量保留** `VIEWFINDER.glassPill` |
| `DARK.recRed` | **物理常量保留** `VIEWFINDER.recRed` |

- [ ] **Step 1: ModalView 强制 dark**

`ModalView.tsx`:`<ThemeProvider forceScheme="dark">`。

- [ ] **Step 2: 精简物理常量文件**

`src/camera/colors/dark.ts` → 重写为:
```ts
// 相机取景物理常量:design dark token 无法表达的少数值。
// 取景永远纯黑(letterbox);控件玻璃药丸浮在明亮画面上需半透明黑底
// (design glass token 是半透明白,给深色界面用,此处不适用);录制红用 iOS 标准色。
export const VIEWFINDER = {
  black: '#000',
  glassPill: 'rgba(0,0,0,0.42)',
  glassPillStrong: 'rgba(0,0,0,0.45)',
  recRed: '#ff3b30',
} as const;
```
(保留文件名 `dark.ts`,或改名 `viewfinder.ts` 并更新所有 import — 二选一,推荐改名 `viewfinder.ts` 语义更准。)

- [ ] **Step 3: 逐组件替换**

每个用 `DARK` 的组件:在组件内取 `const c = useColors();`,按映射表替换。StyleSheet 里写死的颜色挪进组件内联样式(因为依赖 `c`),或用 `useThemedStyles(makeStyles)` 模式(design 提供)。物理常量从 `VIEWFINDER` import。

逐文件列表(grep `DARK` 确认):`src/camera/Container.tsx`、`Camera.tsx`、`setup/SideRail.tsx`、`setup/SideActions.tsx`、`footer/ZoomChips.tsx`、`footer/*`、`preview/PreviewOverlay.tsx`、`preview/*`、`watermark/*`、`CaptureFlash.tsx`、`FocusIndicator.tsx`(对焦框颜色:橙→`c.primary`)。

- [ ] **Step 4: 删旧 colors/dark.ts 测试 / 改**

`src/camera/colors/dark.test.ts`:改为测 `VIEWFINDER` 常量(或删,B9 处理)。

- [ ] **Step 5: 验证 + Commit**

Run: `yarn typecheck && yarn lint && yarn test`
Expected: PASS(测试里若有断言具体颜色值,更新为 token)。
```bash
git add -A
git commit -m "refactor(camera): use design dark theme tokens, keep only viewfinder physical constants"
```
> 真机验证(用户):暗色一致、控件可读。

---

## Task B3: 静音图标接入 design(点3)— **依赖 A1 发版**

**Files:**
- Modify: `package.json`(design 升到含 sound-off 版本)
- Modify: `src/camera/setup/SideRail.tsx`
- Delete: `src/camera/icons/VolumeIcon.tsx`(+ 空目录 `src/camera/icons/`)
- Modify/Delete: `src/camera/icons/VolumeIcon.test.tsx`

- [ ] **Step 1: 升 design 到 sound-off 版本**

`package.json` peer/dev `@unif/react-native-design` → A1 发布版本(回填)。Run `yarn`。

- [ ] **Step 2: SideRail 用 design Icon**

`SideRail.tsx`:删 `import { VolumeIcon } from '../icons/VolumeIcon';`;`sound-btn` 内改:
```tsx
<Icon name={sound ? 'sound' : 'sound-off'} size={r(20)} color={sound ? c.primary : c.foreground} />
```
(颜色用 B8 的 token。)

- [ ] **Step 3: 删 VolumeIcon + 测试**

```bash
git rm src/camera/icons/VolumeIcon.tsx src/camera/icons/VolumeIcon.test.tsx
```
(若 `src/camera/icons/` 空则一并移除。)

- [ ] **Step 4: 验证 + Commit**

Run: `yarn typecheck && yarn lint && yarn test src/camera/setup/SideRail.test.tsx`
Expected: PASS(`SideRail.test` 改为断言 `Icon name=sound/sound-off`)。
```bash
git add -A
git commit -m "feat(camera): use design sound/sound-off icon, drop self-drawn VolumeIcon"
```

---

## Task B9: 测试统一到 `src/__tests__/`(镜像结构)

**Files:** 移动 22 个 colocate 测试 → `src/__tests__/<mirror>`。

- [ ] **Step 1: 移动文件(镜像路径)**

逐个 `git mv`(示例):
```bash
git mv src/camera/footer/ActionRow.test.tsx src/__tests__/camera/footer/ActionRow.test.tsx
git mv src/camera/footer/FlipButton.test.tsx src/__tests__/camera/footer/FlipButton.test.tsx
git mv src/camera/footer/ModeSwitcherPill.test.tsx src/__tests__/camera/footer/ModeSwitcherPill.test.tsx
git mv src/camera/footer/RecordingTimer.test.tsx src/__tests__/camera/footer/RecordingTimer.test.tsx
git mv src/camera/footer/Shutter.test.tsx src/__tests__/camera/footer/Shutter.test.tsx
git mv src/camera/footer/ThumbnailStack.test.tsx src/__tests__/camera/footer/ThumbnailStack.test.tsx
git mv src/camera/footer/ZoomChips.test.tsx src/__tests__/camera/footer/ZoomChips.test.tsx
git mv src/camera/preview/groupTypes.test.ts src/__tests__/camera/preview/groupTypes.test.ts
git mv src/camera/preview/PreviewBottomBar.test.tsx src/__tests__/camera/preview/PreviewBottomBar.test.tsx
git mv src/camera/preview/PreviewOverlay.test.tsx src/__tests__/camera/preview/PreviewOverlay.test.tsx
git mv src/camera/preview/PreviewTopBar.test.tsx src/__tests__/camera/preview/PreviewTopBar.test.tsx
git mv src/camera/setup/SideActions.test.tsx src/__tests__/camera/setup/SideActions.test.tsx
git mv src/camera/setup/SideRail.test.tsx src/__tests__/camera/setup/SideRail.test.tsx
git mv src/camera/watermark/burnWatermark.test.ts src/__tests__/camera/watermark/burnWatermark.test.ts
git mv src/camera/watermark/layout.test.ts src/__tests__/camera/watermark/layout.test.ts
git mv src/camera/watermark/WatermarkStamp.test.tsx src/__tests__/camera/watermark/WatermarkStamp.test.tsx
git mv src/camera/CaptureFlash.test.tsx src/__tests__/camera/CaptureFlash.test.tsx
git mv src/camera/FocusIndicator.test.tsx src/__tests__/camera/FocusIndicator.test.tsx
git mv src/components/Carousel/SlideItem.test.tsx src/__tests__/components/Carousel/SlideItem.test.tsx
git mv src/components/VideoPlayer.test.tsx src/__tests__/components/VideoPlayer.test.tsx
```
`colors/dark.test.ts`:若 B8 改名为 `viewfinder.ts`,对应 `src/__tests__/camera/viewfinder.test.ts`;若已删则跳过。
`Camera.test.tsx`(若存在):`git mv` 到 `src/__tests__/camera/Camera.test.tsx`。

- [ ] **Step 2: 修每个移动文件的相对 import**

colocate 时 `import X from './X'` / `'../X'` → 改为指向 `src/` 源码的新相对路径(如 `src/__tests__/camera/footer/ActionRow.test.tsx` 引 `../../../camera/footer/ActionRow`)。逐文件改正。

- [ ] **Step 3: jest 配置确认**

确认 `package.json` jest / `jest.config` 的 `roots`/`testMatch` 覆盖 `src/__tests__/**`(现有 7 个已在此,通常无需改)。

- [ ] **Step 4: 全量测试 + Commit**

Run: `yarn test`
Expected: 全绿。
```bash
git add -A
git commit -m "test(camera): consolidate all tests under src/__tests__ mirroring source tree"
```

---

## Task B10: 文档全量更新 + 重生成 llms

**Files:** `CLAUDE.md`、`README.md`、`AGENTS.md`、`website/docs/getting-started/installation.md`、`website/static/md/getting-started/installation.md`、`website/docusaurus.config.ts`、`website/src/clientModules/rn-globals.ts`

- [ ] **Step 1: CLAUDE.md**

- peers 清单(L84 区)删 `@gorhom/bottom-sheet`。
- 删"必须挂 `<ConfirmHost/>` + `<ToastHost/>`"那条(相机内已自带本地弹窗,不再依赖)。
- 测试约定改为"统一 `src/__tests__/`(镜像源码结构),不再 colocate"。
- 图标:补"相机不自绘图标,全部用 design `Icon`(`FocusIndicator` 是对焦动画除外)"。
- 暗色:补"相机用 design dark token(`ThemeProvider forceScheme='dark'` + `useColors`),仅 `viewfinder` 物理常量例外"。
- 删/改网格相关描述;补 0.5x 超广角说明。

- [ ] **Step 2: README.md / AGENTS.md**

`README.md` L29 安装命令去 `@gorhom/bottom-sheet`;`AGENTS.md` 如有相关同步。

- [ ] **Step 3: website 安装文档**

`website/docs/getting-started/installation.md`(L38 命令、L59 依赖表)+ `website/static/md/...` 副本:删 `@gorhom/bottom-sheet` 行;若有 ConfirmHost/ToastHost 接入说明、网格、暗色相关,按新行为更新。`docusaurus.config.ts` / `rn-globals.ts` 的 bottom-sheet 注释举例按需换成其它库。

- [ ] **Step 4: 重生成 llms**

Run: `yarn workspace website build:llms`
Expected: `website` 下 `llms.txt` / `llms-full.txt` 更新。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: drop @gorhom/bottom-sheet, update host/grid/theme/test conventions, rebuild llms"
```

---

## 收尾验证(全部 Task 后)

- [ ] `yarn typecheck && yarn lint && yarn test` 全绿
- [ ] `grep -rn "@gorhom" . --include=*.ts --include=*.tsx --include=*.json --include=*.md | grep -v node_modules | grep -v /lib/` 无残留
- [ ] `grep -rn "from '../icons/VolumeIcon'\|colocate" src` 无残留
- [ ] 交付物清单给用户 + 列出**真机验证项**(点1 居中、点5 0.5x、点7 弹窗、暗色一致)
