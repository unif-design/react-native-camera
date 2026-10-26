package com.facebook.react
import android.app.Application
import camera.boundary.Boundary
interface ReactApplication { val reactHost: ReactHost }
interface ReactPackage
class ReactHost(val context: Application, val packages: List<ReactPackage>)
open class ReactActivityDelegate
class PackageList(app: ReactApplication) {
  init { Boundary.record("packages.autolink", app) }
  val packages: MutableList<ReactPackage> = mutableListOf(autolinked)
  companion object { val autolinked = object : ReactPackage {} }
}
object ReactNativeApplicationEntryPoint {
  fun loadReactNative(app: ReactApplication) { Boundary.record("react.load", app) }
}
