import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import com.intellij.rt.coverage.report.api.Filters;
import com.intellij.rt.coverage.report.api.ReportApi;

/** Writes the collector's unmodified counters; no source/class exclusions. */
public final class CoverageReport {
  public static void main(String[] arguments) throws Exception {
    List<File> reports = new ArrayList<>();
    for (int index = 3; index < arguments.length; index++) {
      reports.add(new File(arguments[index]));
    }
    ReportApi.xmlReport(new File(arguments[0]), "Camera native", reports,
        Collections.singletonList(new File(arguments[1])),
        Collections.singletonList(new File(arguments[2])), Filters.EMPTY);
  }
}
