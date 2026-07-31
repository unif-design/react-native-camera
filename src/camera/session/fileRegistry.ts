export type OwnedFileState = 'owned' | 'transferred' | 'deleted';

export type UnlinkFile = (path: string) => Promise<void>;

export type FileCleanupFailure = {
  path: string;
  error: unknown;
};

export type ReportFileCleanupFailure = (failure: FileCleanupFailure) => void;

export type FileRegistry = {
  register: (path: string) => void;
  stateOf: (path: string) => OwnedFileState | undefined;
  delete: (path: string) => Promise<void>;
  replace: (rawPath: string, finalPath: string) => Promise<void>;
  transfer: (paths: readonly string[]) => void;
  drain: () => Promise<void>;
};

const reportCleanupFailureByDefault: ReportFileCleanupFailure = ({
  path,
  error,
}) => {
  console.warn(
    `[react-native-camera] Failed to delete owned temporary file: ${path}`,
    error
  );
};

export function createFileRegistry(
  unlink: UnlinkFile,
  reportCleanupFailure: ReportFileCleanupFailure = reportCleanupFailureByDefault
): FileRegistry {
  const files = new Map<string, OwnedFileState>();

  const register = (path: string) => {
    if (!files.has(path)) files.set(path, 'owned');
  };

  const deleteFile = async (path: string) => {
    if (files.get(path) !== 'owned') return;

    // 先同步摘除所有权再 await；重复清理与并发 drain 都只能发起一次 unlink。
    files.set(path, 'deleted');
    try {
      await unlink(path);
    } catch (error) {
      try {
        reportCleanupFailure({ path, error });
      } catch {
        // reporter 只负责诊断；自身失败也不能阻塞 settle 或重新取得文件所有权。
      }
    }
  };

  const replace = async (rawPath: string, finalPath: string) => {
    if (rawPath === finalPath) return;
    register(finalPath);
    await deleteFile(rawPath);
  };

  const transfer = (paths: readonly string[]) => {
    paths.forEach((path) => {
      if (files.get(path) === 'owned') files.set(path, 'transferred');
    });
  };

  const drain = async () => {
    const pending = [...files.entries()]
      .filter(([, state]) => state === 'owned')
      .map(([path]) => deleteFile(path));
    await Promise.all(pending);
  };

  return {
    register,
    stateOf: (path) => files.get(path),
    delete: deleteFile,
    replace,
    transfer,
    drain,
  };
}
