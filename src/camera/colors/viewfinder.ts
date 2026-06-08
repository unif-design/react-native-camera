// 相机取景物理常量:design dark token 无法表达的少数值。
// 取景永远纯黑(letterbox);控件玻璃药丸浮在明亮画面上需半透明黑底
// (design glass token 是半透明白,给深色界面用,此处不适用);录制红用 iOS 标准色。
export const VIEWFINDER = {
  black: '#000',
  glassPill: 'rgba(0,0,0,0.42)',
  glassPillStrong: 'rgba(0,0,0,0.45)',
  recRed: '#ff3b30',
} as const;
