package com.facebook.react.bridge
interface NativeModule
open class ReactApplicationContext
interface Promise {
  fun resolve(value: Any?)
  fun reject(code: String, message: String?, error: Throwable)
}
