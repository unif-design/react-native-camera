import React from 'react';
import { View } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useCamera } from '../hooks';
import type { CameraResult } from '../utils';

function Harness({ onResult }: { onResult: (r: CameraResult) => void }) {
  const [api, holder] = useCamera();
  React.useEffect(() => {
    api
      .open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' })
      .then(onResult);
    // close right away to test cancel path
    queueMicrotask(() => api.close());
  }, [api, onResult]);
  return (
    <>
      <View testID="harness-sentinel" />
      {holder}
    </>
  );
}

it('resolves with code 0 when close() is called', async () => {
  const onResult = jest.fn();
  render(<Harness onResult={onResult} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ code: 0, data: [], message: 'cancelled' })
  );
});
