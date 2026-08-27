# 低内存照片文件管线实施计划

1. 在最新 `main` 上建立任务分支，保存旧链路失败测试证据。
2. 将 photo output 改为最终画幅 FHD，并切换到 `capturePhotoToFile()` + 原生元数据读取。
3. 增加内部 Codegen TurboModule；iOS 实现 ImageIO/Core Image/CoreText 直接文件输出。
4. Android 实现 BitmapFactory 采样 + 单目标 Bitmap/Canvas + OutputStream 直接输出。
5. 保持 `useCamera()`、水印、画幅、token、冻结回看和 FileRegistry 语义，补错误阶段诊断。
6. 更新仓库规则、接入文档和官网生成内容。
7. 运行 JS/类型/格式/构建门禁，两端原生编译交给本地快速 target 与 PR CI 双重验证。
8. 在 iPhone X 上做连续拍摄 Instruments/系统日志回归；证据不足时明确标为待真机门禁。
9. 提交并推送任务分支，创建 PR；不合并、不发布 npm、不修改 Portal。
