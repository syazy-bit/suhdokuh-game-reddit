import type { CertificationReport, CIReport } from "./result";
import { toCIReport } from "./certification";
import * as fs from "fs";
import * as path from "path";

export function writeCertificationArtifacts(
  report: CertificationReport,
  outputDir: string,
): Promise<{ certPath: string; ciPath: string }> {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(outputDir);
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) { reject(err); return; }

      const certPath = path.join(dir, "certification-report.json");
      const ciPath = path.join(dir, "ci-summary.json");

      const ci: CIReport = toCIReport(report);

      fs.writeFile(certPath, JSON.stringify(report, null, 2), (err) => {
        if (err) { reject(err); return; }
        fs.writeFile(ciPath, JSON.stringify(ci, null, 2), (err) => {
          if (err) { reject(err); return; }
          resolve({ certPath, ciPath });
        });
      });
    });
  });
}
