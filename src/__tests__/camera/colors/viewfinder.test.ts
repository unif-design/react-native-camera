import { VIEWFINDER } from '../../../camera/colors/viewfinder';

it('exposes viewfinder physical constants', () => {
  expect(VIEWFINDER.black).toBe('#000');
  expect(VIEWFINDER.glassPill).toBe('rgba(0,0,0,0.42)');
  expect(VIEWFINDER.glassPillStrong).toBe('rgba(0,0,0,0.45)');
  expect(VIEWFINDER.footerScrim).toBe('rgba(0,0,0,0.4)');
  expect(VIEWFINDER.recRed).toBe('#ff3b30');
});
