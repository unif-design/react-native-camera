package camera.boundary
object Boundary {
  val events = mutableListOf<Pair<String, Any?>>()
  fun record(name: String, value: Any?) { events += name to value }
}
