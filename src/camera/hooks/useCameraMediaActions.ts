import { useCallback } from 'react';
import type { CapturedFile } from '../../utils';
import { discardOwnedFiles, type FileRegistry } from '../session/fileRegistry';
import type { CameraSessionController } from './useCameraSessionController';

type MediaController = Pick<
  CameraSessionController,
  'openPreview' | 'closePreview' | 'deleteFile' | 'clearFiles' | 'save'
>;

/** Photo and video share review/save/delete commands, independent of capture. */
export function useCameraMediaActions(
  { openPreview, closePreview, deleteFile, clearFiles, save }: MediaController,
  registry: FileRegistry
) {
  const openGallery = useCallback(
    () => openPreview({ variant: 'gallery', index: 0 }),
    [openPreview]
  );
  const deleteMedia = useCallback(
    (file: CapturedFile): boolean => {
      const removed = deleteFile(file.path);
      if (removed == null) return false;
      discardOwnedFiles(registry, [removed.path]);
      return true;
    },
    [deleteFile, registry]
  );
  const clear = useCallback((): boolean => {
    const removed = clearFiles();
    if (removed == null) return false;
    discardOwnedFiles(
      registry,
      removed.map((file) => file.path)
    );
    return true;
  }, [clearFiles, registry]);

  return { openGallery, closePreview, deleteMedia, clear, save };
}
