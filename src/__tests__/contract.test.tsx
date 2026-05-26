import type { CameraResult, CameraResultCode } from '../utils';

it('CameraResult.code is a known set', () => {
  const codes: CameraResultCode[] = [0, 200, 403, 404, 500, 503];
  codes.forEach((c) => {
    const r: CameraResult = { code: c, data: [], message: '' };
    expect(typeof r.code).toBe('number');
  });
});

// 反向验证：未声明的 code 应当不被允许
it('rejects invalid code at compile time', () => {
  // @ts-expect-error 999 is not a valid CameraResultCode
  const bad: CameraResult = { code: 999, data: [], message: '' };
  expect(bad.code).toBe(999);
});
