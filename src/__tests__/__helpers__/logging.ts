import { installLogging } from '@unif/react-native-logger';
import type {
  DiagnosticRecord,
  LogFileStore,
  LoggingHandle,
} from '@unif/react-native-logger';

let currentHandle: LoggingHandle | undefined;

/** 仅诊断断言等待Logger，不让测试中的拍摄／取消流程等待日志。 */
export async function flushTestLogging(): Promise<void> {
  if (!currentHandle) throw new Error('test logger is not installed');
  await currentHandle.flush();
}

/** 使用真实日志运行时，只替换本地文件边界。 */
export function registerTestLogging(): DiagnosticRecord[] {
  const records: DiagnosticRecord[] = [];
  let handle: LoggingHandle;
  beforeEach(async () => {
    records.length = 0;
    const files: LogFileStore = {
      append: ({ line }) => records.push(JSON.parse(line)),
      setOwner: async () => {},
      flush: async () => {},
      dispose: () => {},
      getStatus: () => ({
        storageMode: 'memory',
        state: 'ready',
        writable: true,
        bufferedBytes: 0,
        droppedCount: 0,
        corruptedLines: 0,
        lastFailureCode: null,
      }),
      readSummary: async () => ({ fileCount: 0, bytes: 0 }),
      clear: async () => ({ status: 'success' }),
      createSnapshot: async () => {
        throw new Error('本测试不创建快照');
      },
      readSnapshot: async () => '',
      releaseSnapshot: async () => {},
      takeSnapshotFile: async () => {
        throw new Error('本测试不交付快照文件');
      },
    };
    handle = installLogging({
      policy: {
        service: 'camera-test',
        allowedFields: [
          'errorType',
          'reason',
          'sourceCode',
          'causeType',
          'causeCode',
          'causeTruncated',
        ],
        startupScopes: [],
      },
      environment: {
        appVersion: 'test',
        platform: 'test',
        osVersion: 'test',
        development: true,
      },
      files,
      createId: () => 'camera-test-run',
    });
    currentHandle = handle;
    await handle.setOwner(null);
  });
  afterEach(async () => {
    try {
      await flushTestLogging();
    } finally {
      currentHandle = undefined;
      handle.dispose();
    }
  });
  return records;
}
