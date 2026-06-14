import { toFileUri, buildPhotoFile, depsAreSame } from '../utils';

describe('toFileUri', () => {
  it('prefixes path with file:// when missing', () => {
    expect(toFileUri('/tmp/x.jpg')).toBe('file:///tmp/x.jpg');
  });
  it('does not double-prefix', () => {
    expect(toFileUri('file:///tmp/x.jpg')).toBe('file:///tmp/x.jpg');
  });
});

describe('buildPhotoFile', () => {
  it('builds image file by default with id/cameraType/cameraMode', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.jpg', width: 100, height: 200 },
      'single',
      'back'
    );
    expect(f.mime).toBe('image/jpeg');
    expect(f.uri).toBe('file:///tmp/a.jpg');
    expect(f.duration).toBeUndefined();
    expect(f.cameraType).toBe('back');
    expect(f.cameraMode).toBe('single');
    expect(f.mode).toBe('single');
    expect(typeof f.id).toBe('string');
    expect(f.isRemake).toBe(false);
  });
  it('builds video file when isVideo=true', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.mp4', width: 1920, height: 1080, duration: 5.2 },
      'video',
      'front',
      true
    );
    expect(f.mime).toBe('video/mp4');
    expect(f.duration).toBe(5.2);
    expect(f.cameraType).toBe('front');
  });
  it('generates unique ids across calls', () => {
    const a = buildPhotoFile(
      { path: '/a.jpg', width: 1, height: 1 },
      'single',
      'back'
    );
    const b = buildPhotoFile(
      { path: '/b.jpg', width: 1, height: 1 },
      'single',
      'back'
    );
    expect(a.id).not.toBe(b.id);
  });
});

describe('depsAreSame', () => {
  it('returns true for empty arrays', () => {
    expect(depsAreSame([], [])).toBe(true);
  });
  it('returns false for different lengths', () => {
    expect(depsAreSame([1], [1, 2])).toBe(false);
  });
  it('uses Object.is comparison', () => {
    expect(depsAreSame([NaN], [NaN])).toBe(true);
    expect(depsAreSame([0], [-0])).toBe(false);
  });
});
