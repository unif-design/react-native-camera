import { useCamera, toFileUri } from '../mock';

it('mock useCamera returns [api, null] with jest.fn open/close', () => {
  const [api, holder] = useCamera();
  expect(holder).toBeNull();
  expect(jest.isMockFunction(api.open)).toBe(true);
  expect(jest.isMockFunction(api.close)).toBe(true);
});

it('mock open() defaults to cancelled', async () => {
  const [api] = useCamera();
  await expect(
    api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' })
  ).resolves.toEqual({ code: 0, data: [], message: 'cancelled' });
});

it('mock open() can be overridden per call', async () => {
  const [api] = useCamera();
  (api.open as jest.Mock).mockResolvedValueOnce({
    code: 200,
    data: [],
    message: 'ok',
  });
  const r = await api.open({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  });
  expect(r.code).toBe(200);
});

it('mock preserves real utils', () => {
  expect(toFileUri('/tmp/x.jpg')).toBe('file:///tmp/x.jpg');
});
