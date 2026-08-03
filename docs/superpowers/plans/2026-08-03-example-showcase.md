# Camera Example 场景展厅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 camera example 改造成基于 Design 0.20 的四场景产品化展厅，完整展示公开配置、结果码、媒体 metadata 与临时文件语义。

**Architecture:** example 使用本地 typed stack；四个场景只产生 `OpenConfig`，根级 run controller 独占一个 `useCamera()` API、一个 holder 和进程内结果历史。纯逻辑负责配置、运行记录和结果投影，React 页面只组合 Design 组件并调用 controller。

**Tech Stack:** React Native 0.86.2、React 19.2.3、TypeScript 6、Jest 29、Testing Library、`@unif/react-native-camera`、`@unif/react-native-design@0.20.0`。

## Global Constraints

- 根开发图和 example 只解析 RN `0.86.2`、React `19.2.3`；匹配的 `@react-native/*` preset/config 为 `0.86.2`，CLI 为 `20.1.0`。
- camera 公共 API、运行时源码和所有公共 peer 不改；`peerDependencies.react-native` 继续为 `>=0.85.0`。
- 公开入口只有 `useCamera()`；example 不直接导入 vision-camera 的 `<Camera>` 或 camera 内部模块。
- 全 App 只调用一次 `useCamera()`，holder 在固定根位置无条件渲染一次；场景屏不得拥有 holder。
- 只生成公开 `OpenConfig`/`CameraMode`/`WatermarkType` 字段，不出现 `aspectRatio`、resolution、zoom、sound 等臆造配置。
- 只有 code `200` 是成功；code `0` 是中性取消；`503` 是保留码且不得声称当前真机可触发。
- 成功文件仍在临时目录；example 不复制、上传、转码或持久化媒体。
- Design 组件只从包根导入；颜色只用 `useColors()`，样式只用模块顶层 `makeStyles` + `useThemedStyles()`；不得新增硬编码 hex/rgba、RN `Pressable + Text` 等价控件或 `console.*`。
- Carousel 5 / RNGH 3 只保留现有精确 scoped 例外；禁止 `--force`、`--legacy-peer-deps` 和全局 override。
- 权限边界不变：不增加相册、定位、存储权限；iPhone 保留 portrait + 左右 landscape；相机/麦克风维持现有配置。
- 所有行为代码遵循 TDD；配置/native shell 变更先通过可执行 contract 获得 RED。

---

### Task 1: 迁移 RN 0.86.2 运行图并更新 example contract

**Files:**
- Modify: `package.json`
- Modify: `example/package.json`
- Modify: `yarn.lock`
- Delete: `.yarn/patches/@react-native-gradle-plugin-npm-0.85.0-d5db84ae63.patch`
- Modify: `example/android/settings.gradle`
- Modify: `example/android/build.gradle`
- Modify: `example/android/gradle.properties`
- Modify: `example/android/gradle/wrapper/gradle-wrapper.properties`
- Modify: `example/android/app/build.gradle`
- Modify: `example/android/app/src/main/java/unif/reactnativecamera/example/MainActivity.kt`
- Modify: `example/android/app/src/main/java/unif/reactnativecamera/example/MainApplication.kt`
- Modify: `example/ios/Podfile`
- Modify: `example/ios/ReactNativeCameraExample/AppDelegate.swift`
- Modify: `example/ios/ReactNativeCameraExample.xcodeproj/project.pbxproj`
- Modify: `example/ios/Podfile.lock`
- Modify: `src/__tests__/exampleConfig.test.ts`

**Interfaces:**
- Consumes: 当前 camera native peers、权限/orientation、Worklets plugin、Gradle 9 Foojay contract。
- Produces: 单一 RN 0.86.2 根/example 工具图；删除 0.85 Gradle patch；公共 camera RN peer 保持 `>=0.85.0`。

- [ ] **Step 1: 先改 contract 得到 RED**

把 `src/__tests__/exampleConfig.test.ts` 的旧 patch 测试替换为：

```ts
it('根与 example 使用 RN 0.86.2 且公共 RN peer 不收紧', () => {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const examplePkg = JSON.parse(readExample('package.json'));

  expect(rootPkg.devDependencies['react-native']).toBe('0.86.2');
  expect(examplePkg.dependencies['react-native']).toBe('0.86.2');
  expect(examplePkg.devDependencies['@react-native/metro-config']).toBe('0.86.2');
  expect(examplePkg.devDependencies['@react-native-community/cli']).toBe('20.1.0');
  expect(rootPkg.peerDependencies['react-native']).toBe('>=0.85.0');
  expect(rootPkg.resolutions?.['@react-native/gradle-plugin@npm:0.85.0']).toBeUndefined();
});
```

继续检查安装后的 Foojay `1.0.0`。Provider/holder 的 source contract 由 Task 5 在真实
根装配写入前建立 RED，本任务不提前添加永远失败的结构断言。

- [ ] **Step 2: 运行 RED**

Run: `yarn test src/__tests__/exampleConfig.test.ts --runInBand`

Expected: FAIL，明确指出 RN 仍为 `0.85.0` 或旧 patch resolution 仍存在；不能接受测试语法错误。

- [ ] **Step 3: 更新 manifests、lockfile 与原生模板**

根 dev 的 React/RN、Babel/ESLint/Jest preset 和 example 的 React/RN、
Babel/Jest/Metro/TypeScript preset 使用：

```json
{
  "react": "19.2.3",
  "react-native": "0.86.2",
  "@react-native/babel-preset": "0.86.2",
  "@react-native/eslint-config": "0.86.2",
  "@react-native/jest-preset": "0.86.2",
  "@react-native/metro-config": "0.86.2",
  "@react-native/typescript-config": "0.86.2"
}
```

CLI 三包保持 `20.1.0`。移除 root `resolutions` 中唯一的 RN 0.85 patch 和 patch 文件。
以本机 design repo 的 RN 0.86.2 example 为参考逐项迁移 Android/iOS shell，保留 camera
权限、iPhone orientation、新架构、bundle/application id、Worklets plugin 与所有 native
peers；不得整目录覆盖。

Run:

```sh
yarn install
bundle exec pod install --project-directory=example/ios
```

- [ ] **Step 4: 运行 GREEN 与 immutable 复验**

Run:

```sh
yarn test src/__tests__/exampleConfig.test.ts --runInBand
yarn install --immutable
yarn typecheck
yarn lint
```

Expected: 全部 exit 0；只有已批准的精确 Carousel/RNGH peer 例外。

- [ ] **Step 5: 自审并提交**

Run:

```sh
git diff --check
git status --short
```

```sh
git commit -m "chore: align camera example with React Native 0.86"
```

---

### Task 2: 实现 typed navigation 与四场景配置工厂

**Files:**
- Create: `example/src/navigation/localNavigation.ts`
- Create: `example/src/domain/scenarioConfigs.ts`
- Create: `src/__tests__/example/localNavigation.test.ts`
- Create: `src/__tests__/example/scenarioConfigs.test.ts`

**Interfaces:**
- Consumes: `OpenConfig`、`CameraModeName`、`CameraType`、`FlashMode`、`DataRetainedMode`。
- Produces:
  - `ShowcaseRoute`、`navigationReducer`
  - `buildBasicConfig(options): OpenConfig`
  - `buildMultiModeConfig(retainedMode): OpenConfig`
  - `buildWatermarkConfig(input, now): WatermarkConfigResult`
  - `buildQualityConfig(options): OpenConfig`

- [ ] **Step 1: 写 navigation RED**

```ts
expect(
  navigationReducer(
    { stack: [{ name: 'home' }] },
    { type: 'push', route: { name: 'quality-lab' } }
  )
).toEqual({
  stack: [{ name: 'home' }, { name: 'quality-lab' }],
});
expect(
  navigationReducer({ stack: [{ name: 'home' }] }, { type: 'back' })
).toEqual({ stack: [{ name: 'home' }] });
```

联合固定为 `home/basic-capture/multi-mode/watermark-evidence/quality-lab`，并覆盖 `home`
reset 与 Android back 在根不消费的返回值。

- [ ] **Step 2: 写四工厂 RED**

使用字面 fixture：

```ts
expect(
  buildBasicConfig({
    mode: 'single',
    type: 'back',
    flashMode: 'auto',
    quality: 0.9,
    recTime: 15,
  })
).toEqual({
  cameraMode: [
    { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
  ],
  dataRetainedMode: 'clear',
});

expect(buildMultiModeConfig('retain')).toEqual({
  cameraMode: [
    { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
    { mode: 'continuous', quality: 0.9 },
    { mode: 'video', recTime: 15 },
  ],
  dataRetainedMode: 'retain',
});
```

水印时间注入固定 `new Date('2026-08-03T10:20:30.000Z')`；空白地点/备注 trim 后移除，
标题空白返回 field error。质量 factory 覆盖 SDK 默认时 key 完全不存在：

```ts
expect(Object.hasOwn(config, 'photoHDR')).toBe(false);
expect(Object.hasOwn(config, 'videoBitRate')).toBe(false);
```

- [ ] **Step 3: 运行 RED**

Run:

```sh
yarn test src/__tests__/example/localNavigation.test.ts src/__tests__/example/scenarioConfigs.test.ts --runInBand
```

Expected: FAIL，原因是目标模块不存在。

- [ ] **Step 4: 写最小实现**

定义输入类型：

```ts
export type BasicConfigInput = {
  mode: CameraModeName;
  type: CameraType;
  flashMode: FlashMode;
  quality: number;
  recTime: number;
};

export type QualityConfigInput =
  | {
      kind: 'photo';
      quality: number;
      prioritization: 'sdk-default' | 'speed' | 'balanced' | 'quality';
      hdr: 'sdk-default' | 'on' | 'off';
    }
  | {
      kind: 'video';
      recTime: number;
      videoBitRate: number | null;
    };
```

只把对应 mode 的字段放入配置；可选全局字段使用 conditional spread，绝不显式传
`undefined`。所有工厂返回新数组/对象，不共享可变 fixture。

- [ ] **Step 5: 运行 GREEN 并提交**

Run:

```sh
yarn test src/__tests__/example/localNavigation.test.ts src/__tests__/example/scenarioConfigs.test.ts --runInBand
yarn typecheck
yarn lint
git diff --check
```

```sh
git commit -m "feat: add camera showcase scenarios"
```

---

### Task 3: 实现 camera run controller、历史与结果投影

**Files:**
- Create: `example/src/domain/cameraRun.ts`
- Create: `example/src/domain/resultPresentation.ts`
- Create: `src/__tests__/example/cameraRun.test.ts`
- Create: `src/__tests__/example/resultPresentation.test.ts`

**Interfaces:**
- Consumes: `CameraApi`、`CameraResult`、`CameraResultCode`、`CustomPhotoFile`、Task 2 的 route/config。
- Produces:
  - `createCameraRunController(deps): CameraRunController`
  - `CameraRunRecord`、`RuntimeDiagnostic`
  - `classifyCameraResult(result): ResultPresentation`
  - `projectMedia(file): MediaPresentation`

- [ ] **Step 1: 写 controller RED**

用官方 mock：

```ts
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
```

测试接口：

```ts
const controller = createCameraRunController({
  api,
  now: () => new Date('2026-08-03T10:20:30.000Z'),
  nextId: () => 'run-1',
});
const outcome = await controller.open('basic-capture', config);
expect(api.open).toHaveBeenCalledWith(config);
expect(outcome.accepted).toBe(true);
expect(outcome.snapshot.records).toHaveLength(1);
expect(outcome.snapshot.records[0]?.result.code).toBe(200);
```

覆盖 opening 期间第二次调用返回 `{ accepted: false, reason: 'busy' }` 且不调用第二次
`api.open`；`close()` 不立即写记录，原 Promise resolve code `0` 后只写一次；unexpected
reject 只写 `RuntimeDiagnostic`，不伪造 CameraResult。

- [ ] **Step 2: 写结果分类 RED**

为 `200/0/403/404/500/503` 使用 literal `CameraResult`。成功 fixture 必须包含完整字段：

```ts
const photo = {
  id: 'photo-1',
  cameraType: 'back',
  cameraMode: 'single',
  path: '/tmp/photo.jpg',
  uri: 'file:///tmp/photo.jpg',
  width: 4032,
  height: 3024,
  mime: 'image/jpeg',
  mode: 'single',
  isRemake: false,
} as const;
```

断言 `200` 投影媒体且 `temporaryFileWarning: true`；其他 code 媒体为空；`503` 标签包含
“保留码，当前实现不主动触发”；cameraMode/mode 只显示一次。

- [ ] **Step 3: 运行 RED**

Run:

```sh
yarn test src/__tests__/example/cameraRun.test.ts src/__tests__/example/resultPresentation.test.ts --runInBand
```

Expected: FAIL，原因是两个模块不存在。

- [ ] **Step 4: 写最小实现**

```ts
export type CameraRunRecord = {
  id: string;
  scenario: Exclude<ShowcaseRoute['name'], 'home'>;
  startedAt: string;
  endedAt: string;
  config: OpenConfig;
  result: CameraResult;
};

export type RuntimeDiagnostic = {
  runId: string;
  scenario: CameraRunRecord['scenario'];
  message: string;
  occurredAt: string;
};

export type CameraRunSnapshot = {
  phase: 'idle' | 'opening';
  records: readonly CameraRunRecord[];
  diagnostics: readonly RuntimeDiagnostic[];
};

export type RunOutcome =
  | { accepted: true; record: CameraRunRecord; snapshot: CameraRunSnapshot }
  | { accepted: false; reason: 'busy'; snapshot: CameraRunSnapshot };

export type CameraRunController = {
  open: (
    scenario: CameraRunRecord['scenario'],
    config: OpenConfig
  ) => Promise<RunOutcome>;
  close: () => void;
  getSnapshot: () => CameraRunSnapshot;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
};
```

controller 对 config 做 example 自己的深拷贝供历史展示；真实运行仍把 factory 新对象传给
`api.open`。active Promise 使用 token 保证 exactly-once；不实现 supersede UI。

- [ ] **Step 5: 运行 GREEN 并提交**

Run:

```sh
yarn test src/__tests__/example/cameraRun.test.ts src/__tests__/example/resultPresentation.test.ts --runInBand
yarn test src/__tests__/example --runInBand
yarn typecheck
yarn lint
git diff --check
```

```sh
git commit -m "feat: add camera showcase run history"
```

---

### Task 4: 组合共享 Design UI 与基础/多模式页面

**Files:**
- Create: `example/src/components/ShowcaseScaffold.tsx`
- Create: `example/src/components/ConfigPreview.tsx`
- Create: `example/src/components/ResultSummary.tsx`
- Create: `example/src/screens/HomeScreen.tsx`
- Create: `example/src/screens/BasicCaptureScreen.tsx`
- Create: `example/src/screens/MultiModeScreen.tsx`
- Create: `src/__tests__/example/basicScreens.test.tsx`

**Interfaces:**
- Consumes: Task 2 navigation/config factories；Task 3 `CameraRunController`/result presentation。
- Produces: 首页、基础拍摄、多模式三个页面与共享 scaffold/config/result UI。

- [ ] **Step 1: 写页面行为 RED**

渲染真实 screen，注入 fake controller（不是 mock camera 组件），验证：

```ts
fireEvent.press(screen.getByRole('button', { name: '基础拍摄' }));
expect(onNavigate).toHaveBeenCalledWith({ name: 'basic-capture' });

fireEvent.press(screen.getByRole('tab', { name: '录像' }));
fireEvent.press(screen.getByRole('button', { name: '打开相机' }));
expect(run.open).toHaveBeenCalledWith(
  'basic-capture',
  expect.objectContaining({
    cameraMode: [expect.objectContaining({ mode: 'video', recTime: 15 })],
  })
);
```

多模式切到 retain 后断言传入 factory 的 literal 配置；opening 时主按钮 disabled。测试只
断言页面可见行为和 controller boundary，不断言 Design 内部层级、样式或 snapshot。

- [ ] **Step 2: 运行 RED**

Run: `yarn test src/__tests__/example/basicScreens.test.tsx --runInBand`

Expected: FAIL，原因是页面不存在。

- [ ] **Step 3: 实现共享 UI**

`ShowcaseScaffold` 使用 `SafeAreaView/ScrollView` 布局和 Design `NavBar`：

```tsx
<NavBar
  title={title}
  left={
    onBack
      ? { icon: 'arrow-left', onPress: onBack, accessibilityLabel: '返回' }
      : undefined
  }
/>
```

入口使用 `EntryCard`；配置用 `Card` + selectable RN `Text`；状态用 `Tag`；动作使用
`Button`。所有 `makeStyles` 在模块顶层，颜色来自 `ColorTokens`。

- [ ] **Step 4: 实现三个页面**

Home 展示四入口与进程内历史；Basic 使用 `Segmented` 选择 mode/type/flash，并按 mode
显示照片 quality 或录像 recTime；Multi 使用 `Segmented` 选择 clear/retain，解释两种
语义并显示实际 JSON。

- [ ] **Step 5: 运行 GREEN 并提交**

Run:

```sh
yarn test src/__tests__/example/basicScreens.test.tsx --runInBand
yarn test src/__tests__/example --runInBand
yarn typecheck
yarn lint
git diff --check
```

```sh
git commit -m "feat: add camera showcase core screens"
```

---

### Task 5: 完成水印/质量/结果页面与根级 holder 装配

**Files:**
- Create: `example/src/components/MediaCard.tsx`
- Create: `example/src/components/ResultHistory.tsx`
- Create: `example/src/screens/WatermarkEvidenceScreen.tsx`
- Create: `example/src/screens/QualityLabScreen.tsx`
- Create: `example/src/app/ShowcaseApp.tsx`
- Replace: `example/src/App.tsx`
- Create: `src/__tests__/example/advancedScreens.test.tsx`
- Create: `src/__tests__/example/App.test.tsx`
- Modify: `src/__tests__/exampleConfig.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 的 routes、factories、controller、presentation 与共享 UI。
- Produces: 四场景完整 navigator、媒体/历史展示，以及唯一 `useCamera()`/holder 根装配。

- [ ] **Step 1: 写高级页面 RED**

水印测试填写标题/地点/备注、选择 `bottom-right`，注入固定 now 后断言完整 content 与
position。质量测试分别覆盖：

```ts
expect(photoConfig).toEqual({
  cameraMode: [{ mode: 'single', quality: 0.85 }],
  dataRetainedMode: 'clear',
  photoQualityPrioritization: 'quality',
  photoHDR: true,
});
expect(Object.hasOwn(defaultPhotoConfig, 'photoHDR')).toBe(false);
expect(videoConfig.videoBitRate).toBe(24_000_000);
```

- [ ] **Step 2: 写 App/结果 RED**

mock `useCamera` 只在公开边界：

```ts
jest.mock('@unif/react-native-camera', () =>
  require('@unif/react-native-camera/mock')
);
render(<App />);
expect(useCamera).toHaveBeenCalledTimes(1);
```

为 holder 使用可见 test fixture element，断言跨导航仍只存在一个；成功照片显示 metadata
与“返回媒体仍位于临时目录”，视频不渲染播放器；取消不显示错误色语义；清空历史后为空。
同时先修改 `exampleConfig.test.ts`，让它对尚未存在的新根结构断言：App 只含一个
`useCamera()` 调用、一个 `{holder}`、Provider 顺序正确且无 `ConfirmHost/ToastHost`。

- [ ] **Step 3: 运行 RED**

Run:

```sh
yarn test src/__tests__/example/advancedScreens.test.tsx src/__tests__/example/App.test.tsx --runInBand
```

Expected: FAIL，原因是高级页面/App 尚不存在。

- [ ] **Step 4: 实现高级页面与结果组件**

水印内容在点击打开时调用 factory 生成时间；不请求定位。质量页用 Design `Segmented`、
`Switch`、`Stepper/Input` 组合，并把 SDK default 表达为 union 值而非 `undefined` 输入。
JPEG 用 RN `Image` 预览；视频只显示 Design `Icon` 与 metadata；路径/JSON selectable。

- [ ] **Step 5: 实现根装配**

根结构固定：

```tsx
<GestureHandlerRootView style={rootStyles.root}>
  <ThemeProvider>
    <SafeAreaProvider>
      <CameraShowcase />
    </SafeAreaProvider>
  </ThemeProvider>
</GestureHandlerRootView>
```

`CameraShowcase` 内只调用一次 `useCamera()`，用 `useMemo` 创建与当前 api 绑定的 controller，
cleanup 调 `api.close()`；渲染顺序为 `<ShowcaseApp ... />` 后紧接 `{holder}`。不要挂
`ConfirmHost/ToastHost`。

- [ ] **Step 6: 运行 App 与 source contract GREEN**

Run:

```sh
yarn test src/__tests__/example/advancedScreens.test.tsx src/__tests__/example/App.test.tsx src/__tests__/exampleConfig.test.ts --runInBand
yarn test src/__tests__/example --runInBand
yarn typecheck
yarn lint
rg -n "console\\.|#[0-9A-Fa-f]{3,8}|rgba\\(" example/src
```

Expected: 测试/typecheck/lint exit 0；最后一条无命中。

- [ ] **Step 7: 提交**

```sh
git diff --check
git commit -m "feat: complete camera example showcase"
```

---

### Task 6: 更新文档、AGENTS 并执行完整门禁

**Files:**
- Modify: `README.md`
- Replace: `example/README.md`
- Modify: `AGENTS.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: Tasks 1–5 的最终路径、命令、版本、场景与真实平台边界。
- Produces: 可复制文档、准确的 RN 0.86.2 当前验证基线、CI 对 example contract/测试的覆盖。

- [ ] **Step 1: 更新 README**

根 README 增加四场景 example 入口。example README 按以下顺序给出实际 Yarn 命令：

```text
安装 → Metro → iOS Pods → Android/iOS 真机构建 → 四场景
→ OpenConfig 边界 → 六种结果码 → 临时文件所有权 → 测试/复制步骤
```

明确 simulator 不能验收相机/Skia；麦克风拒绝留在录像 session，不映射成 code 403/503；
只有 200 成功，503 只在 mock/结果层验证。

- [ ] **Step 2: 更新 AGENTS/CI 当前事实**

AGENTS 区分：

```text
当前仓库开发/example 验证基线：RN 0.86.2、React 19.2.3、Design 0.20.0。
发布包公共 RN peer 仍为 >=0.85.0。
```

CI 保持既有测试并显式运行新的 `src/__tests__/example` 与 exampleConfig contract；不增加
website/llms 生成，因为公共行为与 website 内容未变。

- [ ] **Step 3: 运行完整 JS 门禁**

Run:

```sh
yarn install --immutable
yarn typecheck
yarn lint
yarn test --runInBand
yarn prepare
yarn check:turbo-inputs
```

Expected: 全部 exit 0；Jest 报告 0 failed。

- [ ] **Step 4: 运行 native build**

Run:

```sh
bundle exec pod install --project-directory=example/ios
yarn example build:android
yarn example build:ios
```

Expected: 可用本机工具链下 exit 0。若缺 Android SDK、Xcode/signing 或 vendor artifact，
保存原始失败证据，不用跳过/改 contract 掩盖。

- [ ] **Step 5: 最终规格核对**

逐条核对设计规格 13 节；确认公开 API/peers/runtime 未改、holder 唯一、四工厂只生成公开
字段、六 code 语义、临时文件警告、Design/a11y、README 与 RN 0.86.2 基线都可从 diff
或测试证明。

Run:

```sh
git diff --check
git status --short
git diff --stat
```

- [ ] **Step 6: 提交**

```sh
git commit -m "docs: document camera example showcase"
```
