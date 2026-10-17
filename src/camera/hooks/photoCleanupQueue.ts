import { discardOwnedFiles, type FileRegistry } from '../session/fileRegistry';

export type FileCleanupRequest =
  | { type: 'replace'; rawPath: string; finalPath: string }
  | { type: 'delete'; paths: string[] };
type PendingFileCleanup = FileCleanupRequest & { commitVersion: number };

/** Internal queue: only a committed removal of the frozen image releases its files. */
export function createPhotoCleanupQueue(fileRegistry: FileRegistry) {
  let nextVersion = 0;
  let pending: PendingFileCleanup[] = [];
  return {
    enqueue(cleanup: FileCleanupRequest): number {
      const commitVersion = ++nextVersion;
      pending.push({ ...cleanup, commitVersion });
      return commitVersion;
    },
    consume(throughVersion = Number.POSITIVE_INFINITY): void {
      const ready: PendingFileCleanup[] = [];
      const deferred: PendingFileCleanup[] = [];
      pending.forEach((cleanup) => {
        (cleanup.commitVersion <= throughVersion ? ready : deferred).push(
          cleanup
        );
      });
      pending = deferred;
      ready.forEach((cleanup) => {
        if (cleanup.type === 'delete') {
          discardOwnedFiles(fileRegistry, cleanup.paths);
          return;
        }
        fileRegistry.replace(cleanup.rawPath, cleanup.finalPath).catch(() => {
          // A custom registry rejection cannot roll back the committed photo.
        });
      });
    },
  };
}
