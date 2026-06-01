# 相机 UI Phase 2b — 预览态重写 设计

> **Phase 2b**（共 3 阶段分解之第 2 阶段）。按 Claude Design 原型重写相机「预览态」(S8–S12)。
> 接 2a（取景态，已完成 PR #25），**在同一分支 `feat/camera-ui-phase2a` 叠加**。
> 像素规格见 [digest](../research/2026-05-29-design-spec-digest.md) §S8–S12 + §5，本 spec 只定架构/组件/决策/API/依赖/测试/范围。

**目标（一句话）：** 把相机预览/确认/回看界面按设计稿重写（全屏上滑、左右滑翻页、类型 tab、确认/回看两变体、视频可播放、二次确认/Toast），保持 `open()` 契约不变。

**库现状：** 2a 完成（取景态固定深色 + 返回/保存）。预览入口已在 `Container` 的 `previewing` 分支（现调 `PreViewContainer(files,onRetake,onConfirm)`）。

---

## 1. 范围

| 阶段 | 内容 | 状态 |
|---|---|---|
| 2a 取景态 | S1–S7 | ✅ 完成（PR #25） |
| **2b 预览态（本 spec）** | S8–S12：全屏上滑预览 / 确认页（重拍·保存）/ 回看页（返回·删除）/ 类型分页 tab / 左右滑翻页 / 视频播放 / 二次确认弹窗 / Toast | 设计中 |
| 2c 水印（显示 + 烧图） | — | 待 brainstorm（方案重新讨论） |

**2b 不含：** 取景态（2a 已完成，不动）、水印（2c）。

---

## 2. 锁定的决策

1. **左右滑翻页 → 保留现有 `Carousel`**（react-native-reanimated-carousel）。只**删 filmstrip 缩略图条**（设计稿否决），`SlideItem` 加视频分支。
2. **视频预览 → 真实播放**（用户定）。用 `react-native-video`（**消费端 portal 已装**）；`VideoPlayer` 做播放/暂停（进度条等后续）。库侧需：`package.json` 声明 **peer + devDep**（typecheck/build 解析类型）；`jest.setup.ts` **加 mock**（native 模块，测试环境必须 mock）；README 安装说明。
3. **继续用 @unif/react-native-design**（用户定，更简单）。二次确认（S11）用 design `confirm`、Toast（S12）用 design `toast`；按钮用 `Button`、图标用 `Icon`。`confirm`/`toast` 的 `ConfirmHost`/`ToastHost` 由**消费端 App 根提供**（portal 全局已挂），库不自挂，README 注明（同 `ThemeProvider` 要求）。废弃库内 `useConfirm`（native Alert）。
4. **预览跟随 light/dark 主题** → `useColors()` / `useThemedStyles`（与取景态固定深色相反，符合设计稿「chrome 跟随主题」）。品牌橙 `#EB6E00`（tab 选中 / 保存主按钮）两主题不变。
5. **两变体（confirm / gallery）+ 变体判定在 `Container`** → `previewVariant` state：「非保留(clear)+单拍」拍完 auto → `'confirm'`；缩略图 tap → `'gallery'`。

---

## 3. 架构 / 数据流 / 变体

`Container` 的 `previewing` 分支扩展并改调新 `PreviewOverlay`，其余 Container 不动。

**变体与数据流：**
- **confirm 变体**（非保留+单拍拍完 auto-preview，单张）：
  - 重拍 → 丢弃刚拍那张（`setPhotos([])`）+ 关预览回取景。
  - 保存 → `settle(200, photos)` + design `toast('已保存')`。
- **gallery 变体**（缩略图进 / 保留模式 / 连拍 / 视频，可多张）：
  - 返回 → 关预览回取景（**不 settle**；最终结束靠取景态「保存」）。
  - 删除 → design `confirm('图片删除后无法恢复，确认删除?')` → 确认后从 `photos` 删当前；**删空 → 自动关预览**。
- **左右滑** → `Carousel`，data = 当前 tab 类型过滤后的 photos；`onIndexChange` 更新「第X/Y张」。
- **视频** → `SlideItem` 内 `mime==='video/mp4'` 渲染 `VideoPlayer`（react-native-video，播放/暂停）。
- **类型 tab（S10）** → `photos` 的 distinct 类型 >1 显 tab（连拍N/单拍N/视频N + 共N张），切 tab 过滤 Carousel data；=1 不显、只「共N张」。confirm 变体不分 tab。

**计数：** 「共N张」= `photos.length`（所有类型）；「第X/Y张」= 当前 tab 内 `index+1 / tabData.length`。

---

## 4. 组件分解（单一职责 · 跟随主题 · 可独立测）

| 组件 | 职责 | 现状 |
|---|---|---|
| `PreviewOverlay` | 全屏上滑容器 + 主题底/文字 + 变体路由 + tab 状态 + Carousel data 过滤 | 改写 `PreViewContainer`（并入 `PreView`） |
| `PreviewTopBar` | 类型 label（confirm）/「共N张」/ 类型 tab（gallery 多类型，S10） | 新建 |
| `Carousel` | 左右滑翻页（按当前 tab data） | **保留**（reanimated-carousel） |
| `SlideItem` | 单页：图（contain）**或** `VideoPlayer` | **改**（加视频分支） |
| `VideoPlayer` | `react-native-video` 播放器 + 播放/暂停叠层 | 新建 |
| `PreviewBottomBar` | 说明「第X/Y张」+ 按钮行（重拍/保存 或 返回/删除，design `Button`） | 改写 `PreviewFooter` |
| `preview/groupTypes.ts` | 纯函数：distinct 类型（顺序 连拍/单拍/视频）、计数 | 新建（便于单测） |
| 删除确认 + Toast | design `confirm` / `toast` | 复用（废弃 `useConfirm`） |
| `SinglePre` / `PreView` / `PreViewContainer` / `PreviewFooter` | 旧预览树 | 整合进上述后删/改 |
| `components/PreviewThumbnail` | filmstrip 否决 | **删** |
| `components/Carousel/*` | — | **保留** |

> 像素（圆角/间距/动画/曲线）引用 digest §S8–S12；安全区用 insets。

---

## 5. API 影响（2b）

- `Container` 的 `previewing` 分支改调 `PreviewOverlay`：
```tsx
const [previewVariant, setPreviewVariant] = useState<'confirm' | 'gallery'>('gallery');
// onShutter 非保留+单拍: setPreviewVariant('confirm')
// onOpenPreview(缩略图): setPreviewVariant('gallery')
if (previewing) return (
  <PreviewOverlay
    files={photos}
    variant={previewVariant}
    onRetake={() => { setPhotos([]); setPreviewing(false); }}
    onSave={() => settle({ code: 200, data: photos, message: 'ok' })}
    onBack={() => setPreviewing(false)}
    onDelete={(f) => { const n = photos.filter((x) => x !== f); setPhotos(n); if (!n.length) setPreviewing(false); }}
  />
);
```
- **`open()` 公共契约零改动**（`src/utils/interface.ts` 不动）。
- **新依赖** `react-native-video`：peer + dev + README + jest mock（库侧目前未装，消费端 portal 已装）。

---

## 6. S8–S12 状态映射

| 状态 | 落地 |
|---|---|
| S8 确认页（单拍非保留） | `variant='confirm'`：TopBar 类型 label；Carousel（单张）；BottomBar 重拍/保存 |
| S9 回看（单类型） | `variant='gallery'` 单类型：TopBar「共N张」；Carousel 左右滑；BottomBar 第X/Y张 + 返回/删除 |
| S10 回看（多类型 tab） | `variant='gallery'` 多类型：TopBar 类型 tab + 共N张；切 tab 过滤；BottomBar 第X/Y张 + 返回/删除 |
| S11 二次确认弹窗 | design `confirm`（删除确认） |
| S12 Toast | design `toast('已保存')` |

---

## 7. 主题

- `PreviewOverlay` / `PreviewTopBar` / `PreviewBottomBar`：`useColors()` / `useThemedStyles`（背景/文字/surface 跟随 light/dark）。
- 品牌橙 `#EB6E00`（tab 选中底、保存主按钮）两主题不变；删除红用 design `error`/`danger` 或 `#ff453a`。
- 实现时确认 design primary 是否即 `#EB6E00`；若是用 token，否则钉死橙。
- `SlideItem` 大图区固定黑底（相机惯例，与取景一致）；overlay chrome 跟随主题。

---

## 8. 测试

- **纯逻辑真实单测**：`groupTypes`（distinct 类型顺序、tab 显隐判断、第X/Y张 与 共N张 计算）。
- **组件渲染（mock）**：`PreviewOverlay`/`PreviewTopBar`/`PreviewBottomBar` 渲染 + testID + 变体按钮（confirm: 重拍/保存；gallery: 返回/删除）点击回调；`SlideItem` 视频分支 `not.toThrow`（mock react-native-video）。
- **变体路由**：`PreviewOverlay` 直接传 `variant='confirm'`/`'gallery'` 单测（不经 Container，因 device-ready 在 jest 不可达）。
- **Container 接线**（previewVariant 设值、onDelete 删空关闭）：typecheck + 手测（device 分支 jest 不可达）。
- jest mock：新增 `react-native-video` → 占位 View；design `confirm`/`toast` 已在 design mock（`confirm: () => Promise.resolve(false)`、`toast: () => null`）。

---

## 9. 范围边界

**做（2b）：** S8–S12 全部（确认/回看变体、类型 tab、左右滑、视频播放、删除二次确认、保存 Toast）、跟随主题、`react-native-video` 接入、删 filmstrip。

**不做：** 取景态（2a）、水印（2c）、视频进度条/拖动（后续）、长按连拍。

---

## 10. 待实现时确认

1. design primary 是否 `#EB6E00` → tab/按钮用 token 还是钉死橙。
2. `react-native-video` 在 RN 0.85 / 库 jest 的 mock 形态（`default` 组件 + 命名导出）→ 实现时定（渲染占位 View）。
3. `ConfirmHost`/`ToastHost` 假设消费端已挂（portal 全局有）；README 注明。若某消费端没挂，`confirm`/`toast` 静默失效——必要时库内 modal 顶层兜底挂一个（暂不做）。
4. 删除中间一张后 Carousel 停留 index（前一张或同 index）→ 实现时定。
5. `PreviewThumbnail` 删除前 grep 确认无其它引用。
