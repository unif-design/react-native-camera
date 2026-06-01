# 相机 UI Phase 2c — 水印 设计

> **Phase 2c**（共 3 阶段分解之第 3 阶段）。相机水印：取景器叠加提示 + **保存时把水印烧进成片**。
> 接 2a/2b（已合并入 main，2.7.0）。新分支 `feat/camera-ui-phase2c-watermark`。
> 排版参考 [digest](../research/2026-05-29-design-spec-digest.md) §水印。

**目标（一句话）：** 在「保存」时把可视水印烧进要返回的照片（合规留痕），取景器显示同款戳记作 WYSIWYG 提示；`open()` 加回 `watermark` 入参，其余契约不变。

**重要前提：** 水印是**可视记录**，**不承诺防篡改**（第三方虚拟相机/替换照片的攻击水印无法解决——独立课题，本期不做）。

---

## 1. 范围

| 阶段 | 内容 | 状态 |
|---|---|---|
| 2a 取景态 / 2b 预览态 | S1–S12 | ✅ 已合并（2.7.0） |
| **2c 水印（本 spec）** | 取景戳记叠加（提示）+ **保存时**烧进成片（Skia 离屏合成）+ `OpenConfig.watermark` | 设计中 |

**不做：** 视频水印、防篡改/拍摄真伪、预览层叠加水印（预览显示原图）。

---

## 2. 锁定的决策

1. **烧图机制 = `@shopify/react-native-skia` 离屏合成**（全分辨率，无原版 view-shot 的降采样/setTimeout 折中）。写文件复用 **`react-native-fs`**（portal 已有）。两者作 peer+dev 依赖，消费端安装（README 注明）。
2. **`WatermarkType` = 结构化数组**：
   ```ts
   export type WatermarkType = {
     /** 水印文字,每行一条;数量不限,消费者可自由增减(设计稿默认 3 行) */
     content: string[];
     /** 位置,缺省 'top-right'(上/下 × 左/中/右) */
     position?:
       | 'top-left' | 'top-center' | 'top-right'
       | 'bottom-left' | 'bottom-center' | 'bottom-right';
   };
   ```
   `OpenConfig.watermark?: WatermarkType`（additive、非破坏；不传则无水印）。
3. **烧图时机 = 「保存」(finalize)，不在拍照时、不在预览叠加**：
   - 拍照只累积**原图**；预览(2b)显示**原图**（无水印）。
   - 点「保存」→ 对**要返回的照片**批量烧水印 → `settle(200, 已烧)`；期间显示"处理中"。
   - 取消/重拍/删除掉的照片**不烧**（只烧最终返回的，最高效）。
4. **文字块按内容自适应扩展**：宽度跟随内容、不固定不裁切；按 `position` 锚定 + 水平对齐，在空闲方向扩展：
   - 左（`*-left`）→ 锚左、左对齐、向右扩展。
   - 右（`*-right`）→ 锚右、右对齐、向左扩展（长短行都贴右边）。
   - 中（`*-center`）→ 锚中、居中对齐、向两侧扩展。
   - 纵向：`top-*` 锚顶、`bottom-*` 锚底；`maxWidth`（≈目标宽 70%）兜底换行不溢出。
5. **取景叠加用普通 RN `View`**（戳记提示，`!recording` 显示），不用 Skia frame processor。与烧图**共用排版逻辑**（`layout.ts`），按目标宽度缩放保 WYSIWYG。
6. **烧图失败兜底返原图**，不阻断保存（某张烧失败 → 该张返原图）。

---

## 3. 架构 / 数据流

`Container` 读 `config.watermark`，驱动两处：

**取景叠加（WYSIWYG 提示，不进像素）：**
- `!recording && config.watermark` 时渲染 `<WatermarkStamp watermark={config.watermark} />`（取景框内，按 `position` 锚定 + 自适应对齐）。录制时隐藏（沿用 2a）。

**保存时烧图（核心）：**
- 拍照：`onShutter` → `capture()` → 累积**原图**（不烧）。预览(2b)显示原图。
- 「保存」(finalize) 触发 `settle(200)` 之前 —— Container 的保存处理（取景态 `ActionRow.onSave` 与 预览确认页 `PreviewOverlay.onSave` 共用一个 `handleSave`）：
  ```
  handleSave = async () => {
    if (!config.watermark) return settle(200, photos);
    setBurning(true);                                  // 显示处理中
    const out = await Promise.all(photos.map(p =>
      p.mime === 'image/jpeg' ? burnWatermark(p, config.watermark!) : p  // 视频不烧
    ));
    settle(200, out);
  }
  ```
- `burnWatermark(file, wm)`：fs 读 `file.path` 字节 → `Skia.Image.MakeImageFromEncoded` → 离屏 surface（原图 w×h）→ 画原图 + 画戳记（按 `position` 对齐逐行定位，字号按图宽缩放）→ `snapshot.encodeToBytes`（JPEG）→ fs 写新临时文件 → 返回 `{...file, path: 新, uri: toFileUri(新)}`。**任何异常 → 返回原 `file`**。
- 视频不烧。`burning` 时盖一个 Loading（`components/Loading`）。

---

## 4. 模块 / 组件分解

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/interface.ts` | 加回 `WatermarkType` + `OpenConfig.watermark?` | 改 |
| `src/camera/watermark/layout.ts` | 纯函数：`(targetWidth, wm) → { 行, 字号, padding, maxWidth, align('left'\|'center'\|'right'), anchorX, anchorY }`（按 position 推导） | 新建 |
| `src/camera/watermark/WatermarkStamp.tsx` | 取景戳记（View，调 layout，固定深色，自适应对齐，录制隐藏） | 新建 |
| `src/camera/watermark/burnWatermark.ts` | Skia 离屏合成 `(file, wm) → 新 file`（按 align 逐行定位、fs 写、异常兜底原图） | 新建 |
| `src/camera/watermark/index.tsx` | 导出 | 新建 |
| `src/camera/Container.tsx` | 渲染 WatermarkStamp + `handleSave` 烧图 + `burning` Loading | 改 |
| `jest.setup.ts` | mock `@shopify/react-native-skia` + `react-native-fs` | 改 |
| `package.json` | skia + fs 加 peer/dev | 改 |
| `README.md` | skia/fs 安装 + 水印用法 | 改 |

**自适应对齐实现**（`layout.ts` 由 `position` 推 `align` + `anchorX/Y`）：
- WatermarkStamp（View）：absolute 锚到角/边；`alignItems`=align（right→`flex-end`、center→`center`、left→`flex-start`），各行 `textAlign` 同 align，宽度由内容撑开、`maxWidth` 限顶 → 左/右/中自适应扩展。
- burnWatermark（Skia）：逐行 `font.measureText` 得行宽；左 x=`pad`、右 x=`W-pad-行宽`、中 x=`(W-行宽)/2`；纵向 top/bottom 起始 y 逐行排。

> 字号/padding/maxWidth 表达为相对目标宽度的比例（参考 digest §水印）；overlay 传屏幕框宽、burn 传图片宽，两处一致。

---

## 5. API 影响

- **加回** `OpenConfig.watermark?: WatermarkType`（additive、非破坏）。2c 唯一 API 变更。其余 `open()` 契约不变。

---

## 6. 测试

- **`layout.ts` 纯函数**（内容派生、按宽缩放、6 个 position → align/anchor）→ 真实单测。
- **`WatermarkStamp`** → mock 下 `not.toThrow` + testID + 行数渲染 + 各 position 对齐 + 录制隐藏 + 无 watermark 不渲染。
- **`burnWatermark`** → mock skia+fs，测**编排**：① 调 skia 合成 + fs 写 + 返回新 path；② 抛错 → 返回**原 file**（兜底）；③ 真实像素 = 手测/真机。
- **保存烧图编排**：`handleSave` 有 watermark → 对图片项调 burn、视频项跳过、settle 用已烧；无 watermark → 直接 settle 原图。（device-ready 不可达 → 抽成可测纯逻辑/或手测。）
- **`WatermarkType` 契约** + `OpenConfig.watermark` 可选。

---

## 7. 依赖

- `@shopify/react-native-skia`：**新增** peer + dev + jest mock。消费端安装 + iOS `pod install`。新架构原生支持、与 vision-camera 同源。
- `react-native-fs`：peer + dev + jest mock（portal 已有；库声明 peer 提醒）。
- README 注明"水印为可视记录、不防篡改 + 保存时烧入"。

---

## 8. 范围边界

**做（2c）：** 取景戳记叠加（左/中/右自适应）+ **保存时**照片烧水印（Skia 全分辨率 + fs 写 + 处理中态）+ `OpenConfig.watermark`（6 position）+ 失败兜底。

**不做：** 视频水印、防篡改、预览层叠加水印（预览原图）、可配字体/颜色、`image`/logo（先纯文字 `content`）。

---

## 9. 待实现时确认

1. Skia 离屏合成 + 文字测宽 API（`Surface.MakeOffscreen`/`MakeImageFromEncoded`/`encodeToBytes`/`Font.measureText` 或 `Paragraph`）→ 按装上的 skia 版本 .d.ts 落地。
2. fs 临时文件路径（`TemporaryDirectoryPath`）+ 旧水印临时文件清理。
3. 字号/padding/maxWidth 相对图宽比例系数 → 真机调到与 digest §水印 一致。
4. 多行换行/`bottom-*` 自底向上排的行高与锚点。
5. 多张烧图的"处理中"体验（串行 vs 并行 `Promise.all`；大图多张耗时）。
6. 确认 skia 版本对 RN 0.85 / 新架构兼容。
