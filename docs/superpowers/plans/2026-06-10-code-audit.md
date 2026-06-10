# 代码深度审查 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 注意：本计划是**只读审查**——除 `/tmp/audit/` 工作区、最终报告 `docs/audit/2026-06-10-code-audit.md` 外，不创建/修改任何文件，不修任何代码。Task 2 的并行 dispatch 与 Task 3 的核实必须由主会话执行（spec 防幻觉门槛）。

**Goal:** 按已批准 spec（`docs/superpowers/specs/2026-06-10-code-audit-design.md`）产出六维度代码审查报告并提交。

**Architecture:** 三层流水线——工具硬数据（主会话）→ 五个并行只读 subagent 镜头 → 主会话逐条读原文核实、去重、组装报告。中间产物写 `/tmp/audit/`（抗上下文压缩）。

**Tech Stack:** yarn 4 / tsc / eslint / jest --coverage / jscpd（npx）/ Agent 工具（general-purpose, 只读）/ WebFetch+context7（官方文档核对）

---

### Task 1: 工具硬数据采集

**Files:**
- Create: `/tmp/audit/`（工作区，不进 git）
- 不改仓库任何文件

- [ ] **Step 1: 建工作区，确认分支**

```bash
mkdir -p /tmp/audit && git -C /Users/liulijun/tongyi/unif/react-native-camera branch --show-current
```
Expected: `docs/code-audit-spec`

- [ ] **Step 2: typecheck**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && yarn typecheck 2>&1 | tee /tmp/audit/typecheck.txt
```
Expected: 退出码 0（干净）；若有报错，全文已落 `/tmp/audit/typecheck.txt`，记入报告硬数据节。

- [ ] **Step 3: lint**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && yarn lint 2>&1 | tee /tmp/audit/lint.txt
```
Expected: 退出码 0；任何 warning/error 留档。

- [ ] **Step 4: 测试 + 覆盖率**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && yarn test --coverage 2>&1 | tee /tmp/audit/coverage.txt
```
Expected: 全部测试通过；记录「Tests: N passed」与 coverage summary 表（% Stmts/Branch/Funcs/Lines + 低覆盖文件）。

- [ ] **Step 5: jscpd 重复率（两跑：纯源码 / 含测试）**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && npx -y jscpd src --ignore "**/__tests__/**" --reporters console 2>&1 | tee /tmp/audit/jscpd-src.txt; npx -y jscpd src --reporters console 2>&1 | tee /tmp/audit/jscpd-all.txt
```
Expected: 各输出克隆列表 + 总重复率 %。
Fallback（npx 失败/离线）：两文件写入「jscpd 不可用」，重复维度只靠 Task 2 重复镜头的人工语义复核，报告附录注明方法局限。

- [ ] **Step 6: LOC 与外部依赖引用清单（供 peerDeps 一致性核对）**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && { echo "== LOC 源码(不含测试) =="; find src -name "*.ts" -o -name "*.tsx" | grep -v __tests__ | xargs wc -l | tail -1; echo "== LOC 测试 =="; find src/__tests__ -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1; echo "== 外部 import =="; grep -rhoE "from '[^'./][^']*'" src --include="*.ts" --include="*.tsx" | sort | uniq -c | sort -rn; } 2>&1 | tee /tmp/audit/loc-imports.txt
```
Expected: 源码/测试行数 + 去重后的外部包引用频次表。主会话随后对照 `package.json#peerDependencies`，差异（引用了未声明 / 声明了未引用）记入待核实清单。

---

### Task 2: 五镜头并行 dispatch（一条消息同时发出 5 个 Agent 调用）

**Files:** 无文件改动；五个 agent 全部 `subagent_type: general-purpose`，prompt 内强制只读。

每个 prompt 含相同的公共头（项目/范围/输出格式），差异只在「你的镜头」段。**输出格式三节制（发现/亮点/局限）是 Task 3 核实与 Task 4 组装的输入契约，不可省略。**

- [ ] **Step 1: 并行发出以下 5 个 agent（同一消息内 5 个 Agent 工具调用）**

**公共头（每个 prompt 开头原样包含）：**

```text
你是代码审查 agent。只读分析：绝不创建/修改/删除任何文件，绝不运行有副作用的命令。
项目：/Users/liulijun/tongyi/unif/react-native-camera —— @unif/react-native-camera，基于 react-native-vision-camera 5.x 封装的弹窗式相机库（纯 JS 库，RN 0.85 新架构 Fabric+Nitro，React 19，peer 依赖 @unif/react-native-design）。
先读根目录 CLAUDE.md 建立项目约定认知（注释风格、已知坑、架构决策），再开始审查。
审查范围：根 src/ 全部源码与测试 + 工程配置（package.json、tsconfig.json、tsconfig.build.json、eslint 配置、jest 配置、babel.config.js、lefthook.yml、.github/workflows/）。example/ 与 website/ 不在范围。
输出格式（你的最终消息就是数据，直接按下面结构输出，不要寒暄）：
## 发现
- [建议P0|P1|P2|P3] <file>:<line> — <问题一句话>。证据：<关键代码片段或推理>。修复方向：<一句话，只给方向不展开实现>
（你镜头内某子项审完没有问题时，明确写「<子项>：未发现问题」）
## 亮点
- <file>:<line> — <做对了什么，为何对>
## 局限
- <本镜头没覆盖到或静态分析看不了的>
严重度参考：P0=缺陷应尽快修；P1=明确问题建议修；P2=改进机会；P3=风格可选。宁可低报不夸大。
```

**Agent 1 —— 架构镜头**（description: "架构镜头审查"）。公共头之后接：

```text
你的镜头：代码架构。只关注——
1) 模块边界：src/camera|components|hooks|utils 划分是否清晰，有无越界依赖、循环依赖；
2) Container.tsx 与 5 个 hook（usePermissionFlow/useZoomController/useVideoRecorder/useCaptureFlow/useAppActive）的职责拆分：单一职责？hook 间通信是否清楚？Container 是否仍堆了本该在 hook 里的逻辑？
3) 数据流：OpenConfig 从 useCamera → ModalView → Container → 子组件的传递链是否合理，有无 prop drilling 过深或该用 context 的地方（反之亦审：现状若简单清晰，不必上 context）；
4) 导出面：src/index.tsx 公开面收敛度（只出 useCamera + utils），mock.ts 与 package.json#exports 的契约一致性；
5) 组件耦合：footer/preview/setup/watermark/ui 子树之间的依赖方向是否单向、有无横向乱引。
逐文件读完 src/ 全部非测试源码（约 50 个文件、4000 行内）后再下结论。
```

**Agent 2 —— 质量镜头**（description: "质量镜头审查"）。公共头之后接：

```text
你的镜头：代码质量（逻辑正确性优先）。只关注——
1) 逻辑正确性与边界条件：空数组/undefined/异常路径；异步竞态（连点、卸载后 setState、Promise resolve 后组件已销毁）；
2) 错误处理：try/catch 覆盖、错误吞没、settle/resolve 是否可能双调或漏调（useCamera 的 resolver 生命周期重点查）；
3) 内存管理：Skia 对象 dispose（burnWatermark.ts/cropToRatio.ts 的 finally 逆序释放是否完备、有无遗漏路径）、事件监听/定时器清理、ref 守卫（capturingRef 防重入逻辑是否真挡得住所有并发路径）；
4) reanimated worklet 红线：worklet 内是否只用预算好的数字常量、有无调 JS Remote Function 的风险点（CLAUDE.md 记录过 design r() 在 worklet 内 fatal 的教训，逐个 worklet 排查同类风险）；
5) 性能：不必要的重渲染（inline 对象/函数 prop、缺 memo 的热路径）、大对象在 render 里重建。
逐文件读完 src/ 全部非测试源码，重点文件（useCaptureFlow/burnWatermark/cropToRatio/Camera.tsx/useZoomController/useCamera）逐行过。
```

**Agent 3 —— 重复与简化镜头**（description: "重复镜头审查"）。公共头之后接：

```text
你的镜头：代码重复与可简化性。先读 /tmp/audit/jscpd-src.txt 与 /tmp/audit/jscpd-all.txt（jscpd 工具输出；若内容是「jscpd 不可用」则跳过，全靠人工）。只关注——
1) 工具报出的每个克隆对：逐个打开两处源码判断是「该提取的真重复」还是「形似神异不该合」，给出判断理由；
2) 工具测不出的语义重复：相似的样式块、相似的按钮/图标组合、相似的 guard/clamp 逻辑、preview 与 footer 子树里同构的 UI 模式；
3) 可简化点：过度抽象（只有一个调用方的间接层）、死代码（导出了没人用、参数从不变化）、可合并的相邻小文件；
4) 测试代码的重复模式（setup/mock 样板是否该提 helper——已有 __helpers__/visionCameraMock.ts，看是否用足）。
注意 YAGNI 双向性：报「该提取没提取」也报「不该抽象硬抽象」。
```

**Agent 4 —— 技术选型与最佳实践镜头（联网）**（description: "选型与最佳实践审查"）。公共头之后接：

```text
你的镜头：技术选型 + 官方最佳实践对齐。需要联网（WebFetch / context7 查官方文档；Bash 只许跑 npm view 这类只读查询）。只关注——
1) 技术选型合理性：逐个评估关键 peer 选择——@dr.pogodin/react-native-fs（fork 而非原版的理由是否仍成立）、react-native-nitro-modules+nitro-image、@shopify/react-native-skia、react-native-video 7.x、react-native-reanimated 4.x、reanimated-carousel、@sbaiahmed1/react-native-blur；每个用 npm view <pkg> version 对照 package.json 声明的版本范围，判断是否过时/有更主流替代；
2) vision-camera 5.x API 对齐：用 WebFetch 读 https://react-native-vision-camera.com/docs/guides 相关页（takePhoto/startRecording/zoom/format/photoQualityPrioritization/photoHDR），核对 src/camera/Camera.tsx、useCaptureFlow.ts、useVideoRecorder.ts、useZoomController.ts 的用法是否官方推荐形态、有无弃用 API、有无官方明示的坑未处理；
3) reanimated 4.x 对齐：SharedValue 直驱、useAnimatedProps+createAnimatedComponent(TextInput)、Gesture.Simultaneous 用法是否当前推荐写法（docs.swmansion.com/react-native-reanimated）；
4) Skia 对齐：离屏 surface/encode/dispose 模式是否官方推荐（shopify.github.io/react-native-skia）；
5) 本库自己的文档一致性：WebFetch https://unif-design.github.io/react-native-camera/llms-full.txt，抽查 OpenConfig 字段、result codes、水印行为与 src/utils/interface.ts、Container.tsx 实际实现是否一致（文档漂移也是发现）。
每条结论必须附出处 URL；某项联网失败就标注「未能核对：<原因>」，不要凭记忆断言。
```

**Agent 5 —— 规范与工程镜头**（description: "规范工程审查"）。公共头之后接：

```text
你的镜头：代码规范与工程配置。只关注——
1) TypeScript 严格度：tsconfig 的 strict 家族开关、有无 any/as 滥用、非空断言、@ts-ignore/@ts-expect-error（grep 统计 + 逐个看是否有正当理由）；
2) eslint 配置：规则集严格度、有无被 eslint-disable 绕过的点（grep 统计 + 逐个判断）；
3) 命名与风格一致性：文件命名（大小写混用？px-to-dp.tsx vs depsAreSame.ts）、组件/hook/工具命名模式、import 顺序；
4) 注释规范：CLAUDE.md 要求「中文记录非显而易见决策的 why、能不写就不写」——抽查 10+ 个文件评估执行度（有无废话注释/该写 why 没写的）；
5) 测试规范：__tests__ 镜像结构是否完整（对照源码树找漏测文件）、测试质量（测行为还是测实现细节、断言强度）、jest.setup.ts mock 完备性；
6) 工程配置：package.json（files/exports/peerDeps 三元组、sideEffects、版本范围风格）、builder-bob 配置、lefthook、.github/workflows 的 CI 完整性（lint/test/typecheck/release 链路）、commitlint。
```

Expected: 5 个 agent 各返回三节制结构化结果。任何 agent 失败/空返回 → 用同一 prompt 重试一次；仍失败 → 该镜头由主会话按其 prompt 要点直接深读兜底（记入报告附录）。

- [ ] **Step 2: 汇总落盘**

5 份原始返回原样写入 `/tmp/audit/lens-{arch,quality,dup,bestpractice,convention}.md`（Write 工具），防上下文压缩丢失。

---

### Task 3: 主会话逐条核实与去重

**Files:**
- Create: `/tmp/audit/verified.md`（核实台账）

- [ ] **Step 1: 合并去重**

把 5 份镜头输出的「发现」合成主清单：同一 `file:line`±5 行且同一问题 → 合并为一条（保留多镜头来源标记，严重度先取最高待核）。

- [ ] **Step 2: 逐条读原文核实**

对每条发现：Read 该文件引用行附近（前后各 ~20 行），判定：
- **确认** —— 行号/描述属实 → 定稿严重度（可升降级，理由一句话）
- **驳回** —— 引用不实/误读上下文/CLAUDE.md 已记录的有意决策 → 不入报，台账留一行驳回理由
- **存疑** —— 静态读码无法定论（如真机行为）→ 降为 P2/P3 并标「待真机验证」

联网类结论（Agent 4）：驱动 P0/P1 的引用用 WebFetch 抽查出处 URL 是否支撑该结论；P2/P3 接受但保留出处。

- [ ] **Step 3: 台账落盘**

每核实 10 条左右把增量写入 `/tmp/audit/verified.md`，格式：

```markdown
- [P1·确认] src/camera/hooks/useCaptureFlow.ts:123 — <问题> | 来源:质量+架构 | 证据:<一句话> | 修复方向:<一句话>
- [驳回] src/...:45 — <原报告> | 理由:<为何不成立>
```

Expected: 全部发现有判定；「亮点」同样抽查核实（至少读原文确认存在）。

---

### Task 4: 报告组装

**Files:**
- Create: `docs/audit/2026-06-10-code-audit.md`

- [ ] **Step 1: 按以下骨架组装报告**（`<填:...>` 为执行时从 /tmp/audit/ 台账与工具输出填入的槽位）

```markdown
# @unif/react-native-camera 代码深度审查报告

日期：2026-06-10 · 范围：根 src/ + 工程配置 · 方法：工具硬数据 + 五镜头并行审查 + 主会话逐条核实
分支/基线：docs/code-audit-spec @ <填:HEAD sha>

## 1. 执行摘要

<填:总体结论一段话>

| 维度 | 等级 | 一行结论 |
| --- | --- | --- |
| 技术选型 | 优/良/需改进 | <填> |
| 代码架构 | … | <填> |
| 代码质量 | … | <填> |
| 代码重复率 | … | <填> |
| 最佳实践对齐 | … | <填> |
| 代码规范 | … | <填> |

Top 发现（按严重度）：
| # | 严重度 | 位置 | 问题 |
| --- | --- | --- | --- |
<填:P0/P1 全列，P2 择要>

## 2. 硬数据快照

- LOC：源码 <填> 行 / 测试 <填> 行；测试:源码比 <填>
- 测试：<填:N passed, N suites>；覆盖率 Stmts <填>% / Branch <填>% / Funcs <填>% / Lines <填>%；最低覆盖文件：<填>
- 重复率（jscpd）：纯源码 <填>% · 含测试 <填>%（或「jscpd 不可用，见附录方法局限」）
- typecheck：<填:干净/N 错误> · eslint：<填>

## 3. 分维度详查

（六章同构；发现项按严重度排序；每章末尾列「未发现问题的子项」）

### 3.1 技术选型
### 3.2 代码架构
### 3.3 代码质量
### 3.4 代码重复率
### 3.5 最佳实践对齐（官方文档/llms 核对，每条附出处 URL）
### 3.6 代码规范

每条发现格式：
**[P1] <file>:<line> — <标题>**
问题：<描述> / 依据：<证据或 URL> / 修复建议：<方向与理由，不展开实现>

## 4. 做对的地方

<填:经核实的亮点列表，含 file:line>

## 5. 附录

- 方法论：spec 见 docs/superpowers/specs/2026-06-10-code-audit-design.md；五镜头覆盖范围与原始输出存档说明
- 核实统计：共 <填> 条原始发现，确认 <填> / 驳回 <填> / 存疑 <填>
- 局限声明：静态审查，未做真机验证（相机硬件行为、GPU 水印实效、OOM 阈值）；<填:联网未能核对项>
```

- [ ] **Step 2: 通读自检**

逐项核对 spec 成功标准：六维度都有结论；每条发现有 `file:line` 且经核实；重复率/覆盖率有真实数字（或注明 fallback）；3.5 章关键结论带 URL；发现项可逐个认领。不满足处补齐。

---

### Task 5: 提交

- [ ] **Step 1: 提交报告（仅这一个文件）**

```bash
cd /Users/liulijun/tongyi/unif/react-native-camera && git add docs/audit/2026-06-10-code-audit.md && git commit -m "docs(audit): 2026-06-10 代码深度审查报告（六维度）"
```
Expected: lefthook 通过（md 不触发 lint/types），commitlint 通过。

- [ ] **Step 2: 向用户汇报**

报告路径 + Top 发现摘要 + 是否发 PR 由用户决定（用 superpowers:finishing-a-development-branch 收尾）。
