package android.graphics
import java.io.OutputStream

class Bitmap(val width: Int, val height: Int) {
  var isRecycled = false
  fun recycle() { check(!isRecycled) { "Bitmap recycled twice" }; isRecycled = true }
  enum class Config { ARGB_8888 }
  enum class CompressFormat { JPEG }
  fun compress(format: CompressFormat, quality: Int, stream: OutputStream): Boolean {
    check(!isRecycled); check(quality in 0..100)
    lastQuality = quality
    if (compressFailure) return false
    stream.write(byteArrayOf(1, 2, 3))
    return true
  }
  companion object {
    val allocated = mutableListOf<Bitmap>()
    var allocationFailure = false
    var compressFailure = false
    var lastQuality = -1
    fun createBitmap(width: Int, height: Int, config: Config): Bitmap {
      if (allocationFailure) throw OutOfMemoryError("bitmap allocation")
      require(width > 0 && height > 0)
      return Bitmap(width, height).also { allocated.add(it) }
    }
  }
}
object BitmapFactory {
  var width = 640; var height = 480
  var decodeFailure = false; var boundsFailure = false; var throwOutOfMemory = false
  var lastSample = 0
  class Options {
    var inJustDecodeBounds = false; var outWidth = 0; var outHeight = 0
    var inSampleSize = 1; var inPreferredConfig = Bitmap.Config.ARGB_8888; var inScaled = false
  }
  fun decodeFile(path: String, options: Options): Bitmap? {
    if (options.inJustDecodeBounds) {
      if (boundsFailure) throw IllegalStateException("header unavailable")
      options.outWidth = width; options.outHeight = height
      return null
    }
    if (throwOutOfMemory) throw OutOfMemoryError("decode allocation")
    if (decodeFailure) return null
    lastSample = options.inSampleSize
    return Bitmap(maxOf(1, width / options.inSampleSize), maxOf(1, height / options.inSampleSize)).also { Bitmap.allocated.add(it) }
  }
}
class Matrix {
  companion object { var accepted = true; var lastDestination = floatArrayOf() }
  fun setPolyToPoly(source: FloatArray, sourceIndex: Int, destination: FloatArray, destinationIndex: Int, count: Int): Boolean {
    require(count == 3); lastDestination = destination.copyOf(); return accepted
  }
}
open class Paint(flags: Int = 0) {
  var color = 0; var textSize = 0f; var typeface = Typeface.DEFAULT
  fun setShadowLayer(radius: Float, dx: Float, dy: Float, color: Int) {}
  class FontMetricsInt { var ascent = -8; var descent = 2; var top = -8; var bottom = 2 }
  companion object { const val ANTI_ALIAS_FLAG = 1; const val FILTER_BITMAP_FLAG = 2; const val DITHER_FLAG = 4 }
}
class Canvas(private val bitmap: Bitmap) {
  fun drawColor(color: Int) { check(!bitmap.isRecycled) }
  fun drawBitmap(source: Bitmap, matrix: Matrix, paint: Paint) { check(!bitmap.isRecycled && !source.isRecycled) }
  fun save() = 1
  fun restore() {}
  fun translate(x: Float, y: Float) { lastTranslation = x to y }
  companion object { var lastTranslation = 0f to 0f }
}
object Color {
  const val WHITE = -1
  fun argb(a: Int, r: Int, g: Int, b: Int) = (a shl 24) or (r shl 16) or (g shl 8) or b
}
class Typeface {
  companion object { const val BOLD = 1; const val NORMAL = 0; val DEFAULT = Typeface(); fun create(typeface: Typeface, style: Int) = Typeface() }
}
