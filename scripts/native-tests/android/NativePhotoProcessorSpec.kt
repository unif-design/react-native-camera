package com.unif.reactnativecamera
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
// Generated React Native boundary only; the production module is compiled unchanged.
abstract class NativePhotoProcessorSpec(context: ReactApplicationContext) : NativeModule {
  abstract fun getName(): String
  abstract fun inspectPhotoFile(inputPath: String, promise: Promise)
  abstract fun inspectVideoFile(inputPath: String, promise: Promise)
  abstract fun processPhoto(inputPath: String, outputPath: String, aspectRatio: String, targetWidth: Double, targetHeight: Double, quality: Double, watermarkJson: String, promise: Promise)
  open fun invalidate() {}
  companion object { const val NAME = "UnifPhotoProcessor" }
}
