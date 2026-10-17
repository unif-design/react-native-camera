package android.text.style
import android.graphics.Paint
class StyleSpan(val style: Int)
interface LineHeightSpan {
  fun chooseHeight(text: CharSequence?, start: Int, end: Int, spanstartv: Int, lineHeightSoFar: Int, fontMetrics: Paint.FontMetricsInt)
}
