import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function productionSource(file: string): string {
  return readFileSync(join(process.cwd(), 'src/camera', file), 'utf8');
}

it('uses transactional production hooks and has no spontaneous video delivery path', () => {
  const container = productionSource('Container.tsx');
  const camera = productionSource('Camera.tsx');

  expect(container).not.toContain('useCaptureFlow');
  expect(container).toContain('usePhotoCaptureTransaction');
  expect(container).toContain('useVideoTransaction');
  expect(container).toContain('useCameraSessionController');
  expect(camera).not.toContain('onSpontaneousVideoFinish');
  expect(camera).not.toContain('manualStopRequestedRef');
});
