import {
  consoleTransport,
  createLogger as createDesignLogger,
} from '@unif/react-native-design';
import { defaultLogBackend } from '@unif/react-native-logger';
import { createFileRegistry } from '../../camera/session/fileRegistry';
import { registerTestLogging } from '../__helpers__/logging';

const records = registerTestLogging();

it('Camera 与真实 Design 消费同一 Logger，每个诊断只分发一次且不带媒体信息', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const failure = Object.assign(
    new Error('用户正文 file:///private/customer-photo.jpg token=PRIVATE'),
    { code: 'EACCES' }
  );
  const files = createFileRegistry(async () => {
    throw failure;
  });
  files.register('/private/customer-photo.jpg');

  await files.drain();
  createDesignLogger('DesignIntegration').warn('固定组件诊断');

  expect(consoleTransport).toBe(defaultLogBackend.consoleTransport);
  expect(records).toEqual([
    expect.objectContaining({
      scope: 'camera.files',
      event: 'owned_file_cleanup.failed',
      fields: expect.objectContaining({
        errorType: 'Error',
        sourceCode: 'EACCES',
      }),
    }),
    expect.objectContaining({
      scope: 'sdk.DesignIntegration',
      event: 'sdk.warning',
    }),
  ]);
  expect(warn).toHaveBeenCalledTimes(2);
  expect(JSON.stringify([records, warn.mock.calls])).not.toMatch(
    /用户正文|customer-photo|PRIVATE/
  );
  expect(files.stateOf('/private/customer-photo.jpg')).toBe('deleted');
  warn.mockRestore();
});
