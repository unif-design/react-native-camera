package android.app
import camera.boundary.Boundary
open class Application {
  val applicationContext: Application get() = this
  open fun onCreate() { Boundary.record("application.create", this) }
}
