# Security Policy

## 报告漏洞

发现 `@unif/react-native-camera` 的安全问题,请 **不要** 直接开 public issue,请走以下任一渠道私下报告:

1. **GitHub Security Advisory**(首选):仓库 → Security tab → "Report a vulnerability"
   - 走 GitHub 原生加密通道,可只对 maintainer 可见
   - 可关联 CVE / 申请 CVE ID
2. **邮件**:`382724935@qq.com`(主题加 `[SECURITY]` 前缀)

我们会在 **3 个工作日内** 确认收到,并在 **30 天内** 给出修复计划或不修复理由。

## 支持的版本

只对 `latest` major 提供安全修复。当前为 `2.x`(基于 react-native-vision-camera 5.x)。

| 版本 | 支持 |
|---|---|
| 2.x | ✅ 持续修复 |
| 1.x | ❌ 已停止维护(架构基于 vision-camera 4.x,请升级到 2.x) |

## 披露原则

- 收到报告 → 内部 triage → 私下复现 → 准备 patch → 同步给报告者验证 → 发布 patch + 公开 advisory
- 修复后我们会通过 GitHub Release notes + npm 自动 advisory 通知用户
- 报告者按意愿在 advisory 中署名,我们不强制 disclose 身份

## 依赖链漏洞

本库严重依赖以下第三方包,这些上游漏洞请直接上游报:

- [`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera/security)
- [`react-native`](https://github.com/facebook/react-native/security)
- [`react-native-nitro-modules`](https://github.com/mrousavy/nitro/security)

我们会通过 Dependabot 监控这些上游 advisory,并在 patch 可用时及时升级。
