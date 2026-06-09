---
title: AI Skill
description: "unif-camera 是一个 Agent Skill,教 AI 编码助手正确调用 @unif/react-native-camera 的 API、避免常见幻觉。"
---

# AI Skill：unif-camera

## 这是什么

`unif-camera` 是一个 **Agent Skill**,教 AI 编码助手(Claude Code / Cursor / Codex)正确调用 `@unif/react-native-camera` 的 API、避免常见幻觉。

它把这个弹窗式相机库的关键约定、易错点和参考索引打包给 AI,让助手在你的项目里写代码时按真实 API 来,而不是凭记忆瞎猜。

## 覆盖什么

**何时会触发:** 用 `@unif/react-native-camera` 拍照 / 连拍 / 录像 / 烧录水印(典型场景:巡检拍照存证),或排查黑屏 / peerDeps / result code。

**覆盖的能力:**

- 核心模式:`useCamera()` 返回 `[api, holder]`,`holder` 必须渲染进树,配置都传给 `api.open(config)`。
- result code 处理:只有 `200` 才是成功,`0` 是取消,`403/404/500/503` 兜底。
- 水印:`watermark.content` 每项一行、`position` 六选一,仅对照片生效。
- 易错点:不渲染 holder、把 `0` 当成功、peerDeps 装不齐、误用 `react-native-fs` 而非 `@dr.pogodin/react-native-fs`。

> 公开面只有 `useCamera()`,你不直接碰 vision-camera 的 `<Camera>`;二维码扫描请走 hms-scan skill。

## 如何安装

**Claude Code 插件市场:**

```bash
/plugin marketplace add unif-design/skills
/plugin install unif@unif-skills
```

**或用 skills CLI:**

```bash
npx skills add unif-design/skills
```

## 在 GitHub 查看

skills 全部开源,发布在插件市场仓库 `unif-design/skills`。本 skill 的源码与参考文档:

👉 **[github.com/unif-design/skills · unif-camera](https://github.com/unif-design/skills/tree/main/skills/unif-camera)**

---

装了之后,在你的项目里让 AI 写 `@unif/react-native-camera` 代码会更准。
