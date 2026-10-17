package com.facebook.react.defaults
import android.app.Application
import com.facebook.react.*
import camera.boundary.Boundary
object DefaultNewArchitectureEntryPoint { var fabricEnabled = true }
class DefaultReactActivityDelegate(val activity: ReactActivity, val component: String, val fabric: Boolean) : ReactActivityDelegate()
object DefaultReactHost {
  fun getDefaultReactHost(context: Application, packageList: List<ReactPackage>): ReactHost {
    Boundary.record("react.host", context)
    return ReactHost(context, packageList)
  }
}
