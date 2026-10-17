package android.os
object SystemClock { fun elapsedRealtime() = System.nanoTime() / 1_000_000 }
object Trace {
  var sections = 0
  fun beginSection(name: String) { sections++ }
  fun endSection() { sections-- }
}
