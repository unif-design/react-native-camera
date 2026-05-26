import type {
  CameraMode,
  CameraResult,
  OpenConfig,
  CustomPhotoFile,
} from '../utils';

it('CameraMode accepts photoQuality and jpegQuality', () => {
  const m: CameraMode = {
    mode: 'single',
    photoQuality: 'speed',
    jpegQuality: 0.9,
  };
  expect(m.mode).toBe('single');
});

it('CameraResult has known shape', () => {
  const r: CameraResult = { code: 200, data: [], message: 'ok' };
  expect(r.code).toBe(200);
});

it('OpenConfig requires cameraMode and dataRetainedMode', () => {
  const c: OpenConfig = {
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  };
  expect(c.cameraMode).toHaveLength(1);
});

it('CustomPhotoFile mime is restricted', () => {
  const f: CustomPhotoFile = {
    path: '/tmp/x.jpg',
    uri: 'file:///tmp/x.jpg',
    width: 100,
    height: 100,
    mime: 'image/jpeg',
    mode: 'single',
  };
  expect(f.mime).toBe('image/jpeg');
});
