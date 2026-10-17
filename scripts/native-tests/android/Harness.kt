import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.os.Trace
import android.text.StaticLayout
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.unif.reactnativecamera.ReactNativeCameraPackage
import com.unif.reactnativecamera.UnifPhotoProcessorModule
import java.io.File
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
import org.json.JSONObject

private class Receipt(private val worker: ExecutorService) : Promise {
  private val done = CountDownLatch(1)
  var value: JSONObject? = null
  var code: String? = null
  var cause: Throwable? = null
  var calls = 0
  override fun resolve(value: Any?) {
    this.value = JSONObject(value as String)
    calls++
    done.countDown()
  }
  override fun reject(code: String, message: String?, error: Throwable) {
    this.code = code
    cause = error
    check(!message.isNullOrBlank())
    calls++
    done.countDown()
  }
  fun await(): Receipt {
    check(done.await(10, TimeUnit.SECONDS)) { "native promise did not settle" }
    // Promise settlement precedes native finally blocks; wait for the serial worker too.
    worker.submit {}.get(10, TimeUnit.SECONDS)
    check(calls == 1) { "native promise settled more than once" }
    return this
  }
  fun success(): JSONObject {
    await()
    check(code == null) { "$code: $cause" }
    return checkNotNull(value)
  }
  fun failure(expected: String) {
    await()
    check(code == expected) { "Expected $expected, got $code ($cause)" }
    check(value == null)
  }
}

private fun reset() {
  Bitmap.allocated.clear()
  Bitmap.allocationFailure = false
  Bitmap.compressFailure = false
  Bitmap.lastQuality = -1
  BitmapFactory.width = 640
  BitmapFactory.height = 480
  BitmapFactory.decodeFailure = false
  BitmapFactory.boundsFailure = false
  BitmapFactory.throwOutOfMemory = false
  ExifInterface.orientation = 1
  ExifInterface.failure = false
  Matrix.accepted = true
  StaticLayout.drawFailure = false
  StaticLayout.emptyFontMetrics = false
  MediaMetadataRetriever.failure = false
  MediaMetadataRetriever.releases = 0
  MediaMetadataRetriever.metadata.clear()
  MediaMetadataRetriever.metadata[18] = "640"
  MediaMetadataRetriever.metadata[19] = "480"
}

fun main() {
  val directory = Files.createTempDirectory("camera-native-fixtures-").toFile()
  val input = File(directory, "input.jpg").apply { writeText("original fixture") }
  val output = File(directory, "output.jpg")
  val module = UnifPhotoProcessorModule(ReactApplicationContext())
  val worker = module.javaClass.getDeclaredField("executor").apply { isAccessible = true }
    .get(module) as ExecutorService
  var groups = 0
  fun group(name: String, body: () -> Unit) {
    reset()
    body()
    check(input.readText() == "original fixture") { "source file was changed" }
    check(Bitmap.allocated.all { it.isRecycled }) { "bitmap leaked in $name" }
    check(Trace.sections == 0) { "trace section leaked in $name" }
    groups++
    println("PASS $name")
  }
  fun process(
    ratio: String = "4:3", width: Double = 240.0, height: Double = 320.0,
    quality: Double = 85.0, watermark: String = "null", destination: File = output,
  ): Receipt = Receipt(worker).also {
    module.processPhoto(input.path, destination.path, ratio, width, height, quality, watermark, it)
  }
  try {
    group("package registration and module identity") {
      val factory = ReactNativeCameraPackage()
      check(factory.getModule("unknown", ReactApplicationContext()) == null)
      val created = factory.getModule(UnifPhotoProcessorModule.NAME, ReactApplicationContext()) as UnifPhotoProcessorModule
      check(created.getName() == "UnifPhotoProcessor")
      created.invalidate()
      val info = factory.getReactModuleInfoProvider().getReactModuleInfos().getValue("UnifPhotoProcessor")
      check(info.isTurboModule && !info.isCxxModule && !info.needsEagerInit && !info.canOverrideExistingModule)
      check(info.className == info.name)
    }
    group("all EXIF dimensions and orientation names") {
      for (orientation in 0..9) {
        ExifInterface.orientation = orientation
        val result = Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.success()
        val swapped = orientation in 5..8
        check(result.getInt("width") == if (swapped) 480 else 640)
        check(result.getInt("height") == if (swapped) 640 else 480)
        val name = when (orientation) { 3, 4 -> "down"; 5, 6 -> "right"; 7, 8 -> "left"; else -> "up" }
        check(result.getString("orientation") == name)
      }
      ExifInterface.failure = true
      check(Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.success().getString("orientation") == "up")
    }
    group("internal raw metadata stays distinct from oriented dimensions") {
      ExifInterface.orientation = 6
      val read = module.javaClass.getDeclaredMethod("readMetadata", String::class.java).apply { isAccessible = true }
      val metadata = read.invoke(module, input.path)
      for ((name, expected) in listOf("getRawWidth" to 640, "getRawHeight" to 480, "getDisplayWidth" to 480, "getDisplayHeight" to 640)) {
        val getter = metadata.javaClass.getDeclaredMethod(name).apply { isAccessible = true }
        check(getter.invoke(metadata) == expected)
      }
      val log = module.javaClass.getDeclaredMethod("logStage", String::class.java, Int::class.javaObjectType, Int::class.javaObjectType).apply { isAccessible = true }
      log.invoke(module, "partial-dimension", 640, null)
      check(android.util.Log.entries.last() == "stage=partial-dimension")
    }
    group("invalid photo paths and metadata failures") {
      Receipt(worker).also { module.inspectPhotoFile(File(directory, "absent").path, it) }.failure("E_PHOTO_READ")
      Receipt(worker).also { module.inspectPhotoFile(directory.path, it) }.failure("E_PHOTO_READ")
      input.setReadable(false, false)
      try { Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.failure("E_PHOTO_READ") }
      finally { input.setReadable(true, true) }
      BitmapFactory.width = 0
      Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.failure("E_PHOTO_READ")
      BitmapFactory.width = 10
      BitmapFactory.height = 0
      Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.failure("E_PHOTO_READ")
      BitmapFactory.boundsFailure = true
      Receipt(worker).also { module.inspectPhotoFile(input.path, it) }.failure("E_PHOTO_READ")
      process().failure("E_PHOTO_DECODE")
    }
    group("sampled crop, every EXIF matrix, both aspect ratios") {
      for (orientation in 0..9) for (ratio in listOf("4:3", "16:9")) {
        ExifInterface.orientation = orientation
        val result = process(ratio).success()
        val swapped = orientation in 5..8
        check(result.getInt("width") == if (swapped) if (ratio == "4:3") 240 else 180 else 320)
        check(result.getInt("height") == if (swapped) 320 else if (ratio == "4:3") 240 else 180)
        check(result.getJSONObject("diagnostics").getBoolean("sampled"))
        check(BitmapFactory.lastSample == 2)
        check(Matrix.lastDestination.size == 6 && Matrix.lastDestination.all { it.isFinite() })
        check(output.readBytes().contentEquals(byteArrayOf(1, 2, 3)))
      }
      ExifInterface.orientation = 1
      process().success()
      check(Matrix.lastDestination.contentEquals(floatArrayOf(0f, 0f, 320f, 0f, 0f, 240f)))
      ExifInterface.orientation = 6
      process().success()
      check(Matrix.lastDestination.contentEquals(floatArrayOf(240f, 0f, 240f, 320f, 0f, 0f)))
    }
    group("small images never upscale, integer targets and quality clamp") {
      BitmapFactory.width = 60
      BitmapFactory.height = 90
      val small = process(quality = 105.0).success()
      check(small.getInt("width") == 60 && small.getInt("height") == 80)
      check(!small.getJSONObject("diagnostics").getBoolean("sampled"))
      check(Bitmap.lastQuality == 100)
      process(width = 1.0, height = 1.0, quality = -4.0).success()
      check(Bitmap.lastQuality == 0)
      BitmapFactory.width = 1
      BitmapFactory.height = 1
      val tiny = process(width = 0.0, height = 0.0).success()
      check(tiny.getInt("width") == 1 && tiny.getInt("height") == 1)
      BitmapFactory.width = 900
      BitmapFactory.height = 60
      check(process(width = 90.0, height = 60.0).success().getInt("height") == 60)
    }
    group("watermark placement, blank lines, and font metrics") {
      val positions = listOf("top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right", "unknown")
      for (position in positions) {
        val json = JSONObject().put("position", position).put("content", org.json.JSONArray(listOf("Title", "Detail"))).toString()
        process(watermark = json).success()
        check(Canvas.lastTranslation.first >= 0 && Canvas.lastTranslation.second >= 0)
      }
      for (watermark in listOf("", "  ", "null", "{\"content\":[]}", "{\"content\":[\"  \" ]}", "{\"content\":[\"Title\"]}", "{\"content\":[\"\",\"Detail\"]}")) {
        process(watermark = watermark).success()
      }
      StaticLayout.emptyFontMetrics = true
      process(watermark = "{\"content\":[\"Title\"]}").success()
    }
    group("decode and allocation failures release resources") {
      BitmapFactory.decodeFailure = true
      process().failure("E_PHOTO_DECODE")
      BitmapFactory.decodeFailure = false
      BitmapFactory.throwOutOfMemory = true
      process().failure("E_PHOTO_DECODE")
      BitmapFactory.throwOutOfMemory = false
      Bitmap.allocationFailure = true
      process().failure("E_PHOTO_ALLOCATE")
    }
    group("crop, parsing, layout and output failures release resources") {
      Matrix.accepted = false
      process().failure("E_PHOTO_CROP")
      Matrix.accepted = true
      process(watermark = "broken").failure("E_PHOTO_WATERMARK")
      StaticLayout.drawFailure = true
      process(watermark = "{\"content\":[\"Text\"]}").failure("E_PHOTO_WATERMARK")
      StaticLayout.drawFailure = false
      Bitmap.compressFailure = true
      process().failure("E_PHOTO_ENCODE")
      Bitmap.compressFailure = false
      process(destination = File(directory, "missing/output.jpg")).failure("E_PHOTO_WRITE")
      val blocked = File(directory, "nonempty").apply { mkdir() }
      File(blocked, "child").writeText("preserve")
      process(destination = blocked).failure("E_PHOTO_WRITE")
      check(File(blocked, "child").readText() == "preserve")
    }
    group("video rotation and optional duration contract") {
      for (rotation in listOf(null, "90", "270", "180", "invalid")) {
        for (duration in listOf(null, "0", "1000", "-1", "invalid")) {
          if (rotation == null) MediaMetadataRetriever.metadata.remove(24) else MediaMetadataRetriever.metadata[24] = rotation
          if (duration == null) MediaMetadataRetriever.metadata.remove(9) else MediaMetadataRetriever.metadata[9] = duration
          val result = Receipt(worker).also { module.inspectVideoFile(input.path, it) }.success()
          val swapped = rotation == "90" || rotation == "270"
          check(result.getInt("width") == if (swapped) 480 else 640)
          check(result.getInt("height") == if (swapped) 640 else 480)
          val expected = duration?.toLongOrNull()?.takeIf { it >= 0 }
          check(result.has("durationMs") == (expected != null))
          if (expected != null) check(result.getLong("durationMs") == expected)
        }
      }
      check(MediaMetadataRetriever.releases == 25)
    }
    group("video malformed dimensions and data source failure always release") {
      for (key in listOf(18, 19)) {
        for (invalid in listOf(null, "bad", "0", "-1")) {
          MediaMetadataRetriever.metadata[18] = "640"
          MediaMetadataRetriever.metadata[19] = "480"
          if (invalid == null) MediaMetadataRetriever.metadata.remove(key) else MediaMetadataRetriever.metadata[key] = invalid
          Receipt(worker).also { module.inspectVideoFile(input.path, it) }.failure("E_VIDEO_READ")
        }
      }
      MediaMetadataRetriever.failure = true
      Receipt(worker).also { module.inspectVideoFile(input.path, it) }.failure("E_VIDEO_READ")
      check(MediaMetadataRetriever.releases == 9)
    }
    println("$groups native test groups passed")
  } finally {
    module.invalidate()
    directory.deleteRecursively()
  }
}
