export type OwnedFileState = 'owned' | 'transferred' | 'deleted';

export type UnlinkFile = (path: string) => Promise<void>;

export type FileRegistry = {
  register: (path: string) => void;
  stateOf: (path: string) => OwnedFileState | undefined;
  delete: (path: string) => Promise<void>;
  replace: (rawPath: string, finalPath: string) => Promise<void>;
  transfer: (paths: readonly string[]) => void;
  drain: () => Promise<void>;
};

export function createFileRegistry(unlink: UnlinkFile): FileRegistry {
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
    } catch {
      // 临时文件清理是 best-effort；失败不能阻塞 settle，也不能重新取得文件所有权。
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
