import type { HistogramBin } from "./result";
import type { BenchmarkReport } from "./result";

function svgBar(width: number, height: number, bars: HistogramBin[], color: string): string {
  const padding = 40;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const maxCount = Math.max(...bars.map((b) => b.count));
  const barW = Math.max(2, chartW / bars.length - 2);

  const labels = bars.map((b) => `${b.lower.toFixed(0)}`);
  const yAxisLabel = Math.ceil(maxCount / 5) * 5;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">\n`;
  svg += `  <rect width="${width}" height="${height}" fill="white"/>\n`;

  // Y axis gridlines
  for (let i = 0; i <= 5; i++) {
    const y = padding + chartH - (i / 5) * chartH;
    svg += `  <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#eee" stroke-width="1"/>\n`;
    svg += `  <text x="${padding - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${Math.round((i / 5) * yAxisLabel)}</text>\n`;
  }

  // Bars
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const x = padding + i * (barW + 2) + 1;
    const barH = maxCount > 0 ? (b.count / maxCount) * chartH : 0;
    const y = padding + chartH - barH;
    svg += `  <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" opacity="0.8"/>\n`;
    if (i % Math.max(1, Math.floor(bars.length / 10)) === 0) {
      svg += `  <text x="${x + barW / 2}" y="${height - 5}" text-anchor="middle" font-size="8" fill="#666">${labels[i]}</text>\n`;
    }
  }

  svg += `</svg>`;
  return svg;
}

export function generatePlots(report: BenchmarkReport): Record<string, string> {
  const plots: Record<string, string> = {};
  const colors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1"];

  for (const mode of report.modes) {
    for (const diff of mode.difficulties) {
      const key = `${mode.mode}_${diff.difficulty}`;
      const m = diff.metrics;

      if (m.generationTimeMs.histogram.length > 0) {
        plots[`genTime_${key}.svg`] = svgBar(400, 200, m.generationTimeMs.histogram, colors[0]!);
      }
      if (m.scoreDistribution.histogram.length > 0) {
        plots[`score_${key}.svg`] = svgBar(400, 200, m.scoreDistribution.histogram, colors[1]!);
      }
      if (m.retries.histogram.length > 0) {
        plots[`retries_${key}.svg`] = svgBar(400, 200, m.retries.histogram, colors[2]!);
      }
      if (m.humanSolverCalls.histogram.length > 0) {
        plots[`solverCalls_${key}.svg`] = svgBar(400, 200, m.humanSolverCalls.histogram, colors[3]!);
      }
    }
  }

  return plots;
}

export function writePlots(plots: Record<string, string>, outputDir: string): void {
  const fs = require("fs");
  const path = require("path");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  for (const [name, svg] of Object.entries(plots)) {
    fs.writeFileSync(path.join(outputDir, name), svg, "utf-8");
  }
}
