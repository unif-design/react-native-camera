---
sidebar_position: 3
title: 调用与资源
description: '相机调用、取消、结果状态、水印和临时文件归属。'
---

# 调用与资源

相机以全屏模态呈现。应用准备配置、打开相机并处理结果；取景、拍摄、预览和选择由库完成。

## 调用入口

`useCamera()` 返回 `[camera, holder]`。在稳定的组件树中渲染宿主，调用 `camera.open(input, { signal })` 开始交互。宿主不会预先打开相机；缺少宿主时返回 `failed / unavailable`。

`modes` 决定模式顺序，首项是初始模式。`initialFacing` 与 `initialFlash` 在根级设置，默认分别是 `back` 与 `auto`。`retention` 决定模式切换时是否保留媒体。

## 生命周期

输入校验通过后，已经取消的信号直接返回 `cancelled`。有效新调用接替同一宿主旧调用，旧调用返回 `cancelled`；非法新输入不影响当前交互。每次调用使用自己的 `AbortController`，旧信号不会取消新交互。

真实宿主卸载取消所属调用。React effect 临时重放不自动取消；过期回调不覆盖新调用。一次结果最多交付一次，成功交付后不会被后续取消改写。

## 结果与失败

按 `status` 分支处理：`success` 读取 `media`；`cancelled` 结束本次流程；`failed` 读取 `error.reason` 和 `error.message`。完整失败原因见[类型](/docs/api/types#cameraoutcome)。

局部拍照、录像、麦克风或照片处理错误留在相机内，保留此前媒体。用户明确重试或取消；不自动重拍，也不交付不符合要求的原图。

## 水印与文件

水印由 `watermark.lines` 提供，只写入照片像素，不作用于视频。空数组不生成水印。它不提供防篡改证明。

成功结果仍指向临时文件，`success` 只表示用户选用了媒体。消费者负责文件保存、上传与释放；库只清理尚未交付且属于本轮的文件。`id` 是媒体展示标识，不是业务照片 ID。

相机窗口全屏覆盖，关闭后恢复原页面。取景状态栏跟随实际相机窗口，不要求业务页面逐个补偿。
