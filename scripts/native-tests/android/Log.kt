package android.util
object Log {
  val entries = mutableListOf<String>()
  fun e(tag: String, message: String) { entries.add(message) }
  fun d(tag: String, message: String) { entries.add(message) }
  fun i(tag: String, message: String) { entries.add(message) }
}
