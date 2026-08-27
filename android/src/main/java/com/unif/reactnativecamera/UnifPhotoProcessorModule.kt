package com.unif.reactnativecamera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Typeface
import android.media.ExifInterface
import android.os.SystemClock
import android.os.Trace
import android.text.Layout
import android.text.SpannableString
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.LineHeightSpan
import android.text.style.StyleSpan
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import org.json.JSONObject

/**
 * 文件级照片处理：只读 JPEG 文件头，按目标尺寸采样解码，在一个目标 Bitmap 上完成
 * EXIF 方向、居中裁切、缩放和文字水印，最后直接压缩到 FileOutputStream。
 */
class UnifPhotoProcessorModule(
  reactContext: ReactApplicationContext,
) : NativePhotoProcessorSpec(reactContext) {
  private val executor =
    Executors.newSingleThreadExecutor { task ->
      Thread(task, "unif-photo-processor").apply { isDaemon = true }
    }

  override fun getName(): String = NAME

  override fun inspectPhotoFile(
    inputPath: String,
    promise: Promise,
  ) {
    executor.execute {
      try {
        val metadata = readMetadata(inputPath)
        promise.resolve(
          JSONObject()
            .put("width", metadata.displayWidth)
            .put("height", metadata.displayHeight)
            .put("orientation", orientationName(metadata.orientation))
            .toString(),
        )
      } catch (error: PhotoProcessorException) {
        promise.reject(error.errorCode, "Photo metadata inspection failed", error)
      } catch (error: Throwable) {
        promise.reject(E_READ, "Photo metadata inspection failed", error)
      }
    }
  }

  override fun processPhoto(
    inputPath: String,
    outputPath: String,
    aspectRatio: String,
    targetWidth: Double,
    targetHeight: Double,
    quality: Double,
    watermarkJson: String,
    promise: Promise,
  ) {
    executor.execute {
      Trace.beginSection("UnifPhotoProcessor.process")
      try {
        val result =
          processPhotoFile(
            inputPath = inputPath,
            outputPath = outputPath,
            aspectRatio = aspectRatio,
            requestedTargetWidth = targetWidth.roundToInt(),
            requestedTargetHeight = targetHeight.roundToInt(),
            quality = quality.roundToInt().coerceIn(0, 100),
            watermarkJson = watermarkJson,
          )
        promise.resolve(result.toString())
      } catch (error: PhotoProcessorException) {
        Log.e(TAG, "stage=${error.stage} failed")
        promise.reject(error.errorCode, "Photo processing failed during ${error.stage}", error)
      } catch (error: Throwable) {
        Log.e(TAG, "stage=decode failed")
        promise.reject(E_DECODE, "Photo processing failed during decode", error)
      } finally {
        Trace.endSection()
      }
    }
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  private fun processPhotoFile(
    inputPath: String,
    outputPath: String,
    aspectRatio: String,
    requestedTargetWidth: Int,
    requestedTargetHeight: Int,
    quality: Int,
    watermarkJson: String,
  ): JSONObject {
    val startedAt = SystemClock.elapsedRealtime()
    logStage("read")
    val metadata = readMetadata(inputPath)
    val target =
      orientTarget(
        requestedTargetWidth.coerceAtLeast(1),
        requestedTargetHeight.coerceAtLeast(1),
        metadata.displayWidth,
        metadata.displayHeight,
      )
    val sampleSize =
      calculateInSampleSize(
        metadata.displayWidth,
        metadata.displayHeight,
        target.first,
        target.second,
      )

    var source: Bitmap? = null
    var output: Bitmap? = null
    try {
      logStage("decode", metadata.displayWidth, metadata.displayHeight)
      source =
        try {
          BitmapFactory.decodeFile(
            inputPath,
            BitmapFactory.Options().apply {
              inSampleSize = sampleSize
              inPreferredConfig = Bitmap.Config.ARGB_8888
              inScaled = false
            },
          )
        } catch (error: OutOfMemoryError) {
          throw PhotoProcessorException(E_DECODE, "decode", error)
        }
      if (source == null) {
        throw PhotoProcessorException(E_DECODE, "decode")
      }

      val orientedSize = orientedSize(source.width, source.height, metadata.orientation)
      val crop = computeCrop(orientedSize.first, orientedSize.second, aspectRatio)
      val scale =
        min(
          1.0,
          min(target.first.toDouble() / crop.width, target.second.toDouble() / crop.height),
        )
      val outputWidth = max(1, (crop.width * scale).roundToInt())
      val outputHeight = max(1, (crop.height * scale).roundToInt())

      logStage("allocate", outputWidth, outputHeight)
      output =
        try {
          Bitmap.createBitmap(outputWidth, outputHeight, Bitmap.Config.ARGB_8888)
        } catch (error: OutOfMemoryError) {
          throw PhotoProcessorException(E_ALLOCATE, "surface", error)
        }

      logStage("crop", outputWidth, outputHeight)
      val canvas = Canvas(output)
      canvas.drawColor(Color.WHITE)
      val matrix =
        buildSourceToOutputMatrix(
          source.width,
          source.height,
          metadata.orientation,
          crop,
          outputWidth,
          outputHeight,
        )
      canvas.drawBitmap(
        source,
        matrix,
        Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG),
      )

      val watermark = parseWatermark(watermarkJson)
      if (watermark != null) {
        logStage("watermark", outputWidth, outputHeight)
        try {
          drawWatermark(canvas, outputWidth, outputHeight, watermark)
        } catch (error: Throwable) {
          throw PhotoProcessorException(E_WATERMARK, "watermark", error)
        }
      }

      logStage("encode", outputWidth, outputHeight)
      val outputFile = File(outputPath)
      if (outputFile.exists() && !outputFile.delete()) {
        throw PhotoProcessorException(E_WRITE, "write")
      }
      try {
        BufferedOutputStream(FileOutputStream(outputFile)).use { stream ->
          if (!output.compress(Bitmap.CompressFormat.JPEG, quality, stream)) {
            throw PhotoProcessorException(E_ENCODE, "encode")
          }
          stream.flush()
        }
      } catch (error: PhotoProcessorException) {
        throw error
      } catch (error: Throwable) {
        throw PhotoProcessorException(E_WRITE, "write", error)
      }

      val duration = SystemClock.elapsedRealtime() - startedAt
      Log.i(
        TAG,
        "stage=complete input=${metadata.displayWidth}x${metadata.displayHeight} " +
          "output=${outputWidth}x${outputHeight} sampled=${sampleSize > 1} durationMs=$duration",
      )
      return JSONObject()
        .put("width", outputWidth)
        .put("height", outputHeight)
        .put(
          "diagnostics",
          JSONObject()
            .put("inputWidth", metadata.displayWidth)
            .put("inputHeight", metadata.displayHeight)
            .put("outputWidth", outputWidth)
            .put("outputHeight", outputHeight)
            .put("sampled", sampleSize > 1)
            .put("durationMs", duration),
        )
    } finally {
      if (output != null && !output.isRecycled) output.recycle()
      if (source != null && !source.isRecycled) source.recycle()
    }
  }

  private fun readMetadata(path: String): PhotoMetadata {
    val file = File(path)
    if (!file.isFile || !file.canRead()) {
      throw PhotoProcessorException(E_READ, "read")
    }
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, options)
    if (options.outWidth <= 0 || options.outHeight <= 0) {
      throw PhotoProcessorException(E_READ, "read")
    }
    val orientation =
      try {
        ExifInterface(path).getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL,
        )
      } catch (_: Throwable) {
        ExifInterface.ORIENTATION_NORMAL
      }
    val display = orientedSize(options.outWidth, options.outHeight, orientation)
    return PhotoMetadata(
      rawWidth = options.outWidth,
      rawHeight = options.outHeight,
      displayWidth = display.first,
      displayHeight = display.second,
      orientation = orientation,
    )
  }

  private fun calculateInSampleSize(
    width: Int,
    height: Int,
    requestedWidth: Int,
    requestedHeight: Int,
  ): Int {
    var sample = 1
    if (height > requestedHeight || width > requestedWidth) {
      val halfHeight = height / 2
      val halfWidth = width / 2
      while (
        halfHeight / sample >= requestedHeight &&
          halfWidth / sample >= requestedWidth
      ) {
        sample *= 2
      }
    }
    return sample
  }

  private fun computeCrop(
    width: Int,
    height: Int,
    aspectRatio: String,
  ): CropRect {
    val targetRatio = if (aspectRatio == "16:9") 9.0 / 16.0 else 3.0 / 4.0
    val sourceRatio = width.toDouble() / height.toDouble()
    return if (sourceRatio > targetRatio) {
      val cropWidth = height * targetRatio
      CropRect((width - cropWidth) / 2.0, 0.0, cropWidth, height.toDouble())
    } else {
      val cropHeight = width / targetRatio
      CropRect(0.0, (height - cropHeight) / 2.0, width.toDouble(), cropHeight)
    }
  }

  private fun buildSourceToOutputMatrix(
    sourceWidth: Int,
    sourceHeight: Int,
    orientation: Int,
    crop: CropRect,
    outputWidth: Int,
    outputHeight: Int,
  ): Matrix {
    val sourceCorners =
      floatArrayOf(
        0f,
        0f,
        sourceWidth.toFloat(),
        0f,
        0f,
        sourceHeight.toFloat(),
      )
    val orientedCorners = orientationCorners(sourceWidth, sourceHeight, orientation)
    val destinationCorners = FloatArray(orientedCorners.size)
    var index = 0
    while (index < orientedCorners.size) {
      destinationCorners[index] =
        ((orientedCorners[index] - crop.left) * outputWidth / crop.width).toFloat()
      destinationCorners[index + 1] =
        ((orientedCorners[index + 1] - crop.top) * outputHeight / crop.height).toFloat()
      index += 2
    }
    return Matrix().also { matrix ->
      if (!matrix.setPolyToPoly(sourceCorners, 0, destinationCorners, 0, 3)) {
        throw PhotoProcessorException(E_CROP, "crop")
      }
    }
  }

  private fun orientationCorners(
    width: Int,
    height: Int,
    orientation: Int,
  ): FloatArray {
    val w = width.toFloat()
    val h = height.toFloat()
    return when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> floatArrayOf(w, 0f, 0f, 0f, w, h)
      ExifInterface.ORIENTATION_ROTATE_180 -> floatArrayOf(w, h, 0f, h, w, 0f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> floatArrayOf(0f, h, w, h, 0f, 0f)
      ExifInterface.ORIENTATION_TRANSPOSE -> floatArrayOf(0f, 0f, 0f, w, h, 0f)
      ExifInterface.ORIENTATION_ROTATE_90 -> floatArrayOf(h, 0f, h, w, 0f, 0f)
      ExifInterface.ORIENTATION_TRANSVERSE -> floatArrayOf(h, w, h, 0f, 0f, w)
      ExifInterface.ORIENTATION_ROTATE_270 -> floatArrayOf(0f, w, 0f, 0f, h, w)
      else -> floatArrayOf(0f, 0f, w, 0f, 0f, h)
    }
  }

  private fun orientedSize(
    width: Int,
    height: Int,
    orientation: Int,
  ): Pair<Int, Int> =
    if (
      orientation == ExifInterface.ORIENTATION_TRANSPOSE ||
        orientation == ExifInterface.ORIENTATION_ROTATE_90 ||
        orientation == ExifInterface.ORIENTATION_TRANSVERSE ||
        orientation == ExifInterface.ORIENTATION_ROTATE_270
    ) {
      height to width
    } else {
      width to height
    }

  private fun orientTarget(
    requestedWidth: Int,
    requestedHeight: Int,
    inputWidth: Int,
    inputHeight: Int,
  ): Pair<Int, Int> {
    val shortSide = min(requestedWidth, requestedHeight)
    val longSide = max(requestedWidth, requestedHeight)
    return if (inputWidth > inputHeight) longSide to shortSide else shortSide to longSide
  }

  private fun parseWatermark(json: String): Watermark? {
    if (json == "null" || json.isBlank()) return null
    try {
      val objectValue = JSONObject(json)
      val array = objectValue.getJSONArray("content")
      val lines = List(array.length()) { index -> array.optString(index, "") }
      if (lines.none { it.trim().isNotEmpty() }) return null
      return Watermark(lines, objectValue.optString("position", "top-right"))
    } catch (error: Throwable) {
      throw PhotoProcessorException(E_WATERMARK, "watermark", error)
    }
  }

  private fun drawWatermark(
    canvas: Canvas,
    width: Int,
    height: Int,
    watermark: Watermark,
  ) {
    val shortSide = min(width, height)
    val fontSize = max(1, (shortSide * 0.033).roundToInt())
    val lineHeight = max(fontSize, (fontSize * 1.45).roundToInt())
    val padding = max(0, (shortSide * 0.04).roundToInt())
    val paragraphWidth = max(1, min((width * 0.7).roundToInt(), width - 2 * padding))
    val alignment =
      when {
        watermark.position.endsWith("-left") -> Layout.Alignment.ALIGN_NORMAL
        watermark.position.endsWith("-center") -> Layout.Alignment.ALIGN_CENTER
        else -> Layout.Alignment.ALIGN_OPPOSITE
      }
    val text = watermark.lines.joinToString("\n")
    val styled = SpannableString(text)
    val firstLineEnd = text.indexOf('\n').let { if (it < 0) text.length else it }
    if (firstLineEnd > 0) {
      styled.setSpan(StyleSpan(Typeface.BOLD), 0, firstLineEnd, 0)
    }
    if (styled.isNotEmpty()) {
      // LineHeightSpan.Standard 只在较新 Android 提供；自定义 span 保持本库 API 24 下限。
      styled.setSpan(FixedLineHeightSpan(lineHeight), 0, styled.length, 0)
    }
    val paint =
      TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = fontSize.toFloat()
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        setShadowLayer(
          max(2, (fontSize * 0.1).roundToInt()).toFloat(),
          0f,
          0f,
          Color.argb(179, 0, 0, 0),
        )
      }
    val layout =
      StaticLayout.Builder.obtain(styled, 0, styled.length, paint, paragraphWidth)
        .setAlignment(alignment)
        .setIncludePad(false)
        .build()
    val x =
      when (alignment) {
        Layout.Alignment.ALIGN_NORMAL -> padding.toFloat()
        Layout.Alignment.ALIGN_CENTER -> (width - paragraphWidth) / 2f
        else -> (width - padding - paragraphWidth).toFloat()
      }
    val y =
      if (watermark.position.startsWith("bottom-")) {
        max(0, height - padding - layout.height).toFloat()
      } else {
        padding.toFloat()
      }
    canvas.save()
    canvas.translate(x, y)
    layout.draw(canvas)
    canvas.restore()
  }

  private fun orientationName(orientation: Int): String =
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_180,
      ExifInterface.ORIENTATION_FLIP_VERTICAL,
      -> "down"
      ExifInterface.ORIENTATION_TRANSPOSE,
      ExifInterface.ORIENTATION_ROTATE_90,
      -> "right"
      ExifInterface.ORIENTATION_TRANSVERSE,
      ExifInterface.ORIENTATION_ROTATE_270,
      -> "left"
      else -> "up"
    }

  private fun logStage(
    stage: String,
    width: Int? = null,
    height: Int? = null,
  ) {
    val dimensions = if (width != null && height != null) " size=${width}x$height" else ""
    Log.d(TAG, "stage=$stage$dimensions")
  }

  private data class PhotoMetadata(
    val rawWidth: Int,
    val rawHeight: Int,
    val displayWidth: Int,
    val displayHeight: Int,
    val orientation: Int,
  )

  private data class CropRect(
    val left: Double,
    val top: Double,
    val width: Double,
    val height: Double,
  )

  private data class Watermark(
    val lines: List<String>,
    val position: String,
  )

  private class FixedLineHeightSpan(
    private val lineHeight: Int,
  ) : LineHeightSpan {
    override fun chooseHeight(
      text: CharSequence?,
      start: Int,
      end: Int,
      spanstartv: Int,
      lineHeightSoFar: Int,
      fontMetrics: Paint.FontMetricsInt,
    ) {
      val naturalHeight = fontMetrics.descent - fontMetrics.ascent
      if (naturalHeight <= 0) return
      fontMetrics.descent = (fontMetrics.descent * lineHeight.toFloat() / naturalHeight).roundToInt()
      fontMetrics.ascent = fontMetrics.descent - lineHeight
      fontMetrics.bottom = fontMetrics.descent
      fontMetrics.top = fontMetrics.ascent
    }
  }

  private class PhotoProcessorException(
    val errorCode: String,
    val stage: String,
    cause: Throwable? = null,
  ) : RuntimeException("Photo processing failed during $stage", cause)

  companion object {
    const val NAME = NativePhotoProcessorSpec.NAME
    private const val TAG = "UnifPhotoProcessor"
    private const val E_READ = "E_PHOTO_READ"
    private const val E_DECODE = "E_PHOTO_DECODE"
    private const val E_ALLOCATE = "E_PHOTO_ALLOCATE"
    private const val E_CROP = "E_PHOTO_CROP"
    private const val E_WATERMARK = "E_PHOTO_WATERMARK"
    private const val E_ENCODE = "E_PHOTO_ENCODE"
    private const val E_WRITE = "E_PHOTO_WRITE"
  }
}
