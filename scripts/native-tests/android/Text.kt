package android.text
import android.graphics.Canvas
import android.graphics.Paint
import android.text.style.LineHeightSpan
class TextPaint(flags: Int) : Paint(flags)
class SpannableString(private val value: String) : CharSequence by value {
  val spans = mutableListOf<Any>()
  fun setSpan(span: Any, start: Int, end: Int, flags: Int) { require(start <= end && end <= length); spans.add(span) }
}
open class Layout { enum class Alignment { ALIGN_NORMAL, ALIGN_CENTER, ALIGN_OPPOSITE } }
class StaticLayout(val height: Int) {
  fun draw(canvas: Canvas) { if (drawFailure) throw IllegalStateException("text drawing failed") }
  companion object { var drawFailure = false; var emptyFontMetrics = false }
  class Builder(private val text: SpannableString) {
    fun setAlignment(alignment: Layout.Alignment) = this
    fun setIncludePad(include: Boolean) = this
    fun build(): StaticLayout {
      val metrics = Paint.FontMetricsInt()
      if (emptyFontMetrics) { metrics.ascent = 0; metrics.descent = 0 }
      for (span in text.spans) if (span is LineHeightSpan) span.chooseHeight(text, 0, text.length, 0, 0, metrics)
      return StaticLayout(maxOf(1, metrics.descent - metrics.ascent))
    }
    companion object {
      fun obtain(text: CharSequence, start: Int, end: Int, paint: TextPaint, width: Int): Builder {
        require(width > 0); return Builder(text as SpannableString)
      }
    }
  }
}
