# Camera Photo Output Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止不同 Camera Hook 实例或重挂载操作覆盖、误删彼此的处理后照片。

**Architecture:** 继续由 `processPhoto()` 唯一决定 final path,但把已具备跨 Hook 唯一性的 `raw.id` 纳入文件名。registry、处理流水线和公开类型均不变。

**Tech Stack:** React Native、TypeScript、Jest、Skia、RNFS、Docusaurus

## Global Constraints

- 输出仍位于 `RNFS.TemporaryDirectoryPath` 且为 JPEG。
- 文件名必须包含 `raw.id`、`sessionId` 与 `captureId`,所有片段经过 `safePathSegment()`。
- 不改变 `CustomPhotoFile`、result code、处理失败或 ownership 公共契约。
- 先证明旧实现会让相同 session / capture 的不同 raw 发生碰撞。
- 不手工发布;Camera PR 合并后由 release workflow 自动处理。

---

### Task 1: 锁定跨实例输出碰撞

**Files:**
- Modify: `src/__tests__/camera/image/processPhoto.test.ts`
- Test: `src/__tests__/camera/image/processPhoto.test.ts`

**Interfaces:**
- Consumes: `processPhoto(raw, operation, registry)`。
- Produces: 相同 operation 序号下不同 raw 必须产生不同 final path 的回归契约。

- [ ] **Step 1: 写失败回归**

在首个成功处理用例之后增加:

```ts
it('相同 session/capture 的不同 raw 生成独立 final path', async () => {
  installNativeHarness();
  const firstRaw = makePhotoFile({
    ...makeRaw(),
    id: 'raw-a',
    path: '/native/a.jpg',
    uri: 'file:///native/a.jpg',
  });
  const secondRaw = makePhotoFile({
    ...makeRaw(),
    id: 'raw-b',
    path: '/native/b.jpg',
    uri: 'file:///native/b.jpg',
  });
  const firstRegistry = createFileRegistry(jest.fn(async () => {}));
  const secondRegistry = createFileRegistry(jest.fn(async () => {}));

  firstRegistry.register(firstRaw.path);
  secondRegistry.register(secondRaw.path);
  const first = await processPhoto(firstRaw, makeOperation(), firstRegistry);
  const second = await processPhoto(secondRaw, makeOperation(), secondRegistry);

  expect(first.path).toBe('/tmp/camera_raw-a_42_capture-7.jpg');
  expect(second.path).toBe('/tmp/camera_raw-b_42_capture-7.jpg');
  expect(first.path).not.toBe(second.path);
  expect(firstRegistry.stateOf(first.path)).toBe('owned');
  expect(secondRegistry.stateOf(second.path)).toBe('owned');
});
```

- [ ] **Step 2: 运行测试并确认 RED**

```sh
yarn test src/__tests__/camera/image/processPhoto.test.ts --runInBand
```

Expected: FAIL;旧实现实际返回 `/tmp/camera_42_capture-7.jpg`。

- [ ] **Step 3: 提交回归测试**

```sh
git add src/__tests__/camera/image/processPhoto.test.ts
git commit -m "test(camera): cover photo output collisions"
```

### Task 2: 让 final path 绑定 raw identity

**Files:**
- Modify: `src/camera/image/processPhoto.ts`
- Modify: `src/__tests__/camera/image/processPhoto.test.ts`
- Test: `src/__tests__/camera/image/processPhoto.test.ts`

**Interfaces:**
- Consumes: `CustomPhotoFile.id` 的现有“时间戳 + 进程级计数器”唯一性。
- Produces: `camera_<raw-id>_<session-id>_<capture-id>.jpg`。

- [ ] **Step 1: 修改最小实现**

把 output path 组装改成:

```ts
const outputPath =
  `${RNFS.TemporaryDirectoryPath}/camera_` +
  `${safePathSegment(raw.id)}_` +
  `${safePathSegment(captured.sessionId)}_${safePathSegment(captured.captureId)}.jpg`;
```

- [ ] **Step 2: 更新旧测试的字面输出**

`makeRaw()` 的 `id` 是 `capture-7`,因此所有旧期望统一从:

```text
/tmp/camera_42_capture-7.jpg
```

改为:

```text
/tmp/camera_capture-7_42_capture-7.jpg
```

- [ ] **Step 3: 运行目标测试并确认 GREEN**

```sh
yarn test src/__tests__/camera/image/processPhoto.test.ts --runInBand
```

Expected: 全部通过。

- [ ] **Step 4: 提交实现**

```sh
git add src/camera/image/processPhoto.ts src/__tests__/camera/image/processPhoto.test.ts
git commit -m "fix(camera): isolate processed photo paths"
```

### Task 3: 对齐网站契约

**Files:**
- Modify: `website/docs/getting-started/concepts.md`
- Modify: `website/docs/guides/watermark.md`
- Regenerate: `website/static/llms.txt`
- Regenerate: `website/static/llms-full.txt`

**Interfaces:**
- Consumes: 当前 `usePhotoCaptureTransaction` 与 `Container` 的快门后处理、居中 overlay 实现。
- Produces: website 与 llms 中一致的消费者说明。

- [ ] **Step 1: 修正文案**

把 concepts 的“用户确认时”改为“每次快门后”;把 watermark guide 的 footer 提示改为
“取景画面中央显示「水印生成中…」遮罩”。

- [ ] **Step 2: 重建 llms**

```sh
yarn workspace @unif/react-native-camera-website build:llms
```

- [ ] **Step 3: 验证网站**

```sh
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-camera-website typecheck
yarn workspace @unif/react-native-camera-website build
```

Expected: 全部退出 0。

- [ ] **Step 4: 提交文档**

```sh
git add website/docs/getting-started/concepts.md website/docs/guides/watermark.md \
  website/static/llms.txt website/static/llms-full.txt
git commit -m "docs(camera): align photo processing timing"
```

### Task 4: 完整验证并更新既有 Camera PR

**Files:**
- Verify: all files changed in Tasks 1-3

**Interfaces:**
- Consumes: Tasks 1-3 的提交以及后续同步的 canonical CI。
- Produces: `fix/camera-state-machine-reliability` PR 的新 head。

- [ ] **Step 1: 运行完整门禁**

```sh
yarn test --runInBand
yarn typecheck
yarn lint
yarn prepare
git diff --check
```

- [ ] **Step 2: 把隔离分支推到既有 PR 分支**

```sh
git push origin HEAD:fix/camera-state-machine-reliability
```

- [ ] **Step 3: 等 PR required checks**

```sh
gh pr checks 98 --watch
```

Expected: 所有 required checks 通过后才允许 Ready / merge。
