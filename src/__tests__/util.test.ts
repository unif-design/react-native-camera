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
  it('builds image file by default', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.jpg', width: 100, height: 200 },
      'single'
    );
    expect(f.mime).toBe('image/jpeg');
    expect(f.uri).toBe('file:///tmp/a.jpg');
    expect(f.duration).toBeUndefined();
  });
  it('builds video file when isVideo=true', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.mp4', width: 1920, height: 1080, duration: 5.2 },
      'video',
      true
    );
    expect(f.mime).toBe('video/mp4');
    expect(f.duration).toBe(5.2);
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
