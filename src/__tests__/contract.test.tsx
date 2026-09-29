import * as Camera from '@unif/react-native-camera';
import type { CameraFailure, CameraOutcome } from '@unif/react-native-camera';

it('publishes only useCamera as a runtime API', () => {
  expect(Object.keys(Camera)).toEqual(['useCamera']);
});

it('defines every terminal failure reason', () => {
  const reasons: CameraFailure['reason'][] = [
    'invalid_input',
    'permission_denied',
    'no_device',
    'unavailable',
    'unsupported',
  ];
  for (const reason of reasons) {
    const outcome: CameraOutcome = {
      status: 'failed',
      error: { reason, message: reason },
    };
    expect(outcome.error.reason).toBe(reason);
  }
});

it('rejects unknown statuses and failure reasons', () => {
  // @ts-expect-error only success, cancelled and failed are terminal outcomes.
  const badStatus: CameraOutcome = { status: 'pending' };
  // @ts-expect-error numeric result codes are no longer public.
  const legacy: CameraOutcome = { code: 200, data: [], message: 'ok' };
  const badReason: CameraFailure = {
    // @ts-expect-error arbitrary error codes are not part of the public contract.
    reason: 'recording_error',
    message: 'error',
  };
  expect([badStatus, legacy, badReason]).toHaveLength(3);
});
