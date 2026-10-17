package android.media
class ExifInterface(path: String) {
  init { if (failure) throw IllegalStateException("EXIF unavailable") }
  fun getAttributeInt(tag: String, fallback: Int) = orientation
  companion object {
    var failure = false; var orientation = 1
    const val TAG_ORIENTATION = "Orientation"
    const val ORIENTATION_NORMAL = 1; const val ORIENTATION_FLIP_HORIZONTAL = 2
    const val ORIENTATION_ROTATE_180 = 3; const val ORIENTATION_FLIP_VERTICAL = 4
    const val ORIENTATION_TRANSPOSE = 5; const val ORIENTATION_ROTATE_90 = 6
    const val ORIENTATION_TRANSVERSE = 7; const val ORIENTATION_ROTATE_270 = 8
  }
}
class MediaMetadataRetriever {
  fun setDataSource(path: String) { if (failure) throw IllegalArgumentException("invalid video") }
  fun extractMetadata(key: Int): String? = metadata[key]
  fun release() { releases++ }
  companion object {
    const val METADATA_KEY_VIDEO_WIDTH = 18; const val METADATA_KEY_VIDEO_HEIGHT = 19
    const val METADATA_KEY_VIDEO_ROTATION = 24; const val METADATA_KEY_DURATION = 9
    var failure = false; var releases = 0
    val metadata = mutableMapOf<Int, String>()
  }
}
