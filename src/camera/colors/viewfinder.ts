// 相机取景物理常量:design dark token 无法表达的少数值。
// 取景永远纯黑(letterbox);控件玻璃药丸浮在明亮画面上需半透明黑底
// (design glass token 是半透明白,给深色界面用,此处不适用);录制红用 iOS 标准色。
// footerScrim:footer 浮层遮罩。design c.scrim(dark=0.7)太深(真机反馈),又无更轻
// 的遮罩 token;footer 的半透明保护是相机物理需求(让快门/模式控件在明亮取景上可读),
// 故这里用更轻的半透明黑。
export const VIEWFINDER = {
  black: '#000',
  glassPill: 'rgba(0,0,0,0.42)',
  glassPillStrong: 'rgba(0,0,0,0.45)',
  footerScrim: 'rgba(0,0,0,0.4)',
  recRed: '#ff3b30',
} as const;
