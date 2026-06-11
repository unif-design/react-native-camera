import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';

// 相机 Modal 运行时恒 forceScheme="dark";所有用 useColors/useThemedStyles 的组件测试都要包同一个
// dark Provider 才能对齐运行时。各处此前内联 `const r = (ui) => render(<ThemeProvider forceScheme="dark">…)`
// 重复一份,这里收敛成共享 helper。
//
// 用 RTL 的 `wrapper` 选项(而非把 Provider 拼进 ui):rerender 会自动保持同一 wrapper 包裹,
// 故有 rerender 的测试可直接 rerender(<Comp …/>) 而不必每次重包 Provider。
const DarkWrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider forceScheme="dark">{children}</ThemeProvider>
);

export function renderDark(ui: ReactElement) {
  return render(ui, { wrapper: DarkWrapper });
}
