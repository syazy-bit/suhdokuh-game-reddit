import type { RunSummary } from "./types";

export function formatRunSummary(summary: RunSummary): string {
  const lines: string[] = [];

  lines.push(`Property Test Run: ${summary.passed ? "PASSED" : "FAILED"}`);
  lines.push(`  Total time: ${summary.totalTimeMs}ms`);
  lines.push(`  Total iterations: ${summary.totalIterations}`);
  lines.push(`  Failures: ${summary.failures.length}`);
  lines.push("");

  for (const group of summary.groups) {
    lines.push(`[${group.groupName}] ${group.size}×${group.size}`);
    for (const pr of group.propertyResults) {
      const status = pr.passed ? "PASS" : "FAIL";
      const timeout = pr.timedOut ? " (timed out)" : "";
      lines.push(`  ${status}: ${pr.propertyName} (${pr.iterationsRun}/${pr.totalIterations})${timeout}`);
    }
    lines.push("");
  }

  if (summary.failures.length > 0) {
    lines.push("Failures:");
    for (const f of summary.failures) {
      const detail = f.reason ? `: ${f.reason}` : "";
      lines.push(`  ${f.groupName}/${f.propertyName} @${f.size}×${f.size} iter=${f.iteration}${detail}`);
    }
  }

  return lines.join("\n");
}

export function formatShortSummary(summary: RunSummary): string {
  return summary.passed
    ? `PASSED (${summary.totalIterations} iterations, ${summary.groups.length} groups)`
    : `FAILED (${summary.failures.length} failure(s), ${summary.totalIterations} iterations)`;
}
