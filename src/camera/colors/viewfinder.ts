// 相机取景物理常量:design dark token 无法表达的少数值。
// 取景永远纯黑(letterbox);控件玻璃药丸浮在明亮画面上需半透明黑底
// (design glass token 是半透明白,给深色界面用,此处不适用);录制红用 iOS 标准色。
export const VIEWFINDER = {
  black: '#000',
  glassPill: 'rgba(0,0,0,0.42)',
  glassPillStrong: 'rgba(0,0,0,0.45)',
  // 「生成中」loading 卡片底:比控件玻璃药丸(glassPill)更实 —— 要托住 spinner+大字、浮在
  // 任意照片上都清晰(design glass token 是半透明白,深色相机界面不适用,同 glassPill 理由)。
  loadingCard: 'rgba(0,0,0,0.6)',
  recRed: '#ff3b30',
  // 录制态药丸底:录制红 18% alpha tint(与 recRed 同色系,design 无对应 token)。
  recordingTint: 'rgba(255,59,48,0.18)',
  // 水印文字黑色描影:白字 + 黑影保证水印浮在任意照片上可读(物理常量,非主题色)。
  watermarkShadow: 'rgba(0,0,0,0.7)',
  // 预览图片画布:固定的深灰容器(iOS systemGray6 dark)。4:3/16:9 照片 contain 在其中,
  // 外层画布恒定不变、只有容器内图片比例不同 —— 与纯黑页面区分出稳定的容器边界,
  // 避免不同画幅下「图片区域忽大忽小」的观感(深灰不抢图片,纯黑页面上可辨)。
  previewCanvas: '#1C1C1E',
} as const;
