import type {
  CameraMode,
  CameraResult,
  OpenConfig,
  CustomPhotoFile,
} from '../utils';

it('CameraMode accepts original fields (type/flashMode/quality/recTime)', () => {
  const m: CameraMode = {
    type: 'back',
    flashMode: 'auto',
    mode: 'single',
    quality: 0.9,
    recTime: 15,
  };
  expect(m.mode).toBe('single');
  expect(m.quality).toBe(0.9);
});

it('CameraMode only requires mode', () => {
  const m: CameraMode = { mode: 'continuous' };
  expect(m.mode).toBe('continuous');
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

it('CustomPhotoFile carries original + 2.x fields (union)', () => {
  const f: CustomPhotoFile = {
    id: '1700000000000-0',
    cameraType: 'back',
    cameraMode: 'single',
    path: '/tmp/x.jpg',
    uri: 'file:///tmp/x.jpg',
    width: 100,
    height: 100,
    mime: 'image/jpeg',
    mode: 'single',
  };
  expect(f.mime).toBe('image/jpeg');
  expect(f.cameraMode).toBe(f.mode);
});
