// 取景态固定深色常量。取景器是相机画面,永远深色,不跟随 light/dark 主题;
// 只有预览/弹窗/Toast(2b)走 useColors()。品牌橙两主题都不变。
export const DARK = {
  white: '#fff',
  white95: 'rgba(255,255,255,0.95)',
  white65: 'rgba(255,255,255,0.65)',
  white40: 'rgba(255,255,255,0.4)',
  white25: 'rgba(255,255,255,0.25)',
  white12: 'rgba(255,255,255,0.12)',
  white08: 'rgba(255,255,255,0.08)',
  black: '#000',
  black42: 'rgba(0,0,0,0.42)',
  black45: 'rgba(0,0,0,0.45)',
  orange: '#EB6E00',
  orange16: 'rgba(235,110,0,0.16)',
  orange18: 'rgba(235,110,0,0.18)',
  orange95: 'rgba(235,110,0,0.95)',
  recRed: '#ff3b30',
} as const;
