# Camera 照片输出唯一性设计

## 背景

`processPhoto()` 当前只用 `sessionId + captureId` 生成输出路径。两个 `useCamera()`
实例或 Hook 重挂载都会从相同 session / operation 序号开始,因此可能共同写入
`camera_1_1.jpg`;后续任一 registry 清理该路径时还可能删除另一个会话已转交的照片。

## 目标

1. 即使两个处理操作拥有相同 `sessionId` 与 `captureId`,不同 native raw 照片也必须
   产生不同输出路径。
2. 保留 session / capture 信息以便诊断,不改变公开 API 或 result code。
3. 失败清理、stale operation 与 transfer ownership 继续只操作本次产物。
4. 同步修正文档中已经过时的“确认时处理”和 footer loading 描述。

## 方案

输出名改为:

```text
camera_<raw-id>_<session-id>_<capture-id>.jpg
```

`raw.id` 由 `buildPhotoFile()` 使用进程级“时间戳 + 单调计数器”生成,跨 Hook 实例共享,
并与 native capture 一一对应。所有片段继续经过 `safePathSegment()`,输出仍位于
`RNFS.TemporaryDirectoryPath`。相比新增随机数或 UUID 依赖,该方案复用现有唯一性契约,
可预测、可测试且不扩大运行时依赖。

## 测试

先增加回归:用两个不同 raw `id/path`、相同 session / capture 调用 `processPhoto()`,
断言两个结果路径不同、两个 registry 分别拥有自己的 final,且写入目标互不相同。
该测试在旧实现上必须因路径相同而失败。

实现后更新现有路径断言,运行 processor 单测、完整 Jest、typecheck、lint、prepare、
website llms test / typecheck / build 与 `git diff --check`。

## 文档

- `website/docs/getting-started/concepts.md`:水印在每次快门后处理,不是用户确认时处理。
- `website/docs/guides/watermark.md`:处理期间显示居中的“水印生成中…”遮罩,不是 footer 文案。
- 重新生成 llms 文件并确认生成结果与 website 文档一致。
