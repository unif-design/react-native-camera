import { DARK } from './dark';

it('exposes brand orange and core dark tokens', () => {
  expect(DARK.orange).toBe('#EB6E00');
  expect(DARK.white).toBe('#fff');
  expect(DARK.recRed).toBe('#ff3b30');
  expect(DARK.orange16).toBe('rgba(235,110,0,0.16)');
});
