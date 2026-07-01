import type {
  BenchmarkReport,
  AcceptanceResult,
  RegressionResult,
  DeterminismResult,
  CertificationReport,
  CertificationVerdict,
  CertificationStatus,
  CIReport,
  CertifyOptions,
} from "./result";
import type { CompareOptions } from "./comparison";
import { checkAcceptance } from "./gates";
import { compareReports } from "./comparison";

export function certify(
  current: BenchmarkReport,
  options?: CertifyOptions,
): CertificationReport {
  const profile = options?.profile ?? "default";
  const determinism = options?.determinism ?? null;

  const acceptance = current.config.acceptanceGates
    ? checkAcceptance(current, current.config.acceptanceGates)
    : null;

  let comparison = null;
  if (options?.baseline) {
    const compareOpts: CompareOptions = {};
    if (options.thresholds) compareOpts.thresholds = options.thresholds;
    if (options.polarity) compareOpts.polarity = options.polarity;
    comparison = compareReports(options.baseline, current, compareOpts);
  }

  const regressions = comparison?.regressions ?? null;

  const verdict = computeVerdict(acceptance, regressions, determinism);

  return {
    version: "0.0.29",
    timestamp: new Date().toISOString(),
    profile,
    config: current.config,
    modes: current.modes,
    acceptance,
    determinism,
    comparison: comparison?.comparison ?? null,
    regressions,
    verdict,
  };
}

export function computeVerdict(
  acceptance: AcceptanceResult | null,
  regressions: RegressionResult | null,
  determinism?: DeterminismResult | null,
): CertificationVerdict {
  const blockingRegressions = regressions?.blocking ?? [];
  const advisoryRegressions = regressions?.advisory ?? [];

  const blockingGateFailures = (acceptance?.checks ?? [])
    .filter(c => c.severity === "blocking" && c.status === "fail");

  const advisoryGateFailures = (acceptance?.checks ?? [])
    .filter(c => c.severity === "advisory" && c.status === "fail");

  const determinismFailed = determinism ? determinism.overall > 0 : false;

  const hasBlockingIssue =
    blockingGateFailures.length > 0 ||
    blockingRegressions.length > 0 ||
    determinismFailed;

  const hasAdvisoryIssue =
    advisoryGateFailures.length > 0 ||
    advisoryRegressions.length > 0;

  let status: CertificationStatus;
  if (hasBlockingIssue) {
    status = "FAIL";
  } else if (hasAdvisoryIssue) {
    status = "PASS_WITH_WARNINGS";
  } else {
    status = "PASS";
  }

  return { status, blockingRegressions, advisoryRegressions };
}

export function toCIReport(report: CertificationReport): CIReport {
  const acceptancePassed = report.acceptance?.checks.filter(c => c.status === "pass").length ?? 0;
  const acceptanceFailed = report.acceptance?.checks.filter(c => c.status === "fail").length ?? 0;
  const blocking = report.regressions?.blocking.length ?? 0;
  const advisory = report.regressions?.advisory.length ?? 0;

  return {
    version: report.version,
    timestamp: report.timestamp,
    profile: report.profile,
    status: report.verdict.status,
    counts: { acceptancePassed, acceptanceFailed, blocking, advisory },
    determinism: report.determinism,
  };
}
