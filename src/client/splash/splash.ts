import { navigateTo, requestExpandedMode } from "@devvit/web/client";
import { injectIcons } from "../game/icons";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  injectIcons();

  const startButton = document.getElementById(
    "start-button",
  ) as HTMLButtonElement;
  const descriptionElement = document.getElementById(
    "description",
  ) as HTMLParagraphElement;
  const titleElement = document.getElementById("title") as HTMLHeadingElement;

  if (startButton) {
    startButton.addEventListener("click", (e) => {
      requestExpandedMode(e, "game");
    });
  }

  const devvitLink = document.getElementById("devvit-link");

  if (devvitLink) {
    devvitLink.addEventListener("click", () => {
      navigateTo("https://www.reddit.com/r/Devvit");
    });
  }

  async function fetchGlobalStats() {
    const statsNumberElement = document.getElementById("global-stats-number");
    const statsTextElement = document.getElementById("global-stats-text");
    const statsSrElement = document.getElementById("global-stats-sr");
    if (!statsNumberElement || !statsTextElement || !statsSrElement) return;

    try {
      const response = await fetch("/api/stats/global");
      if (!response.ok) throw new Error("Failed to fetch global stats");
      
      const data = await response.json();
      const totalSolved = data.totalSolved ?? 0;
      const formattedTotal = new Intl.NumberFormat(navigator.language).format(totalSolved);
      
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        statsTextElement.innerHTML = `<strong id="global-stats-number">${formattedTotal}</strong> <span>puzzles solved</span>`;
        statsSrElement.textContent = `${formattedTotal} puzzles solved`;
        return;
      }

      statsTextElement.innerHTML = `<strong id="global-stats-number">0</strong> <span>puzzles solved</span>`;
      const newStatsNumberElement = document.getElementById("global-stats-number")!;

      const duration = 800;
      const start = performance.now();
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

      function update(currentTime: number) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        const currentCount = Math.floor(totalSolved * easeOut(progress));
        
        newStatsNumberElement.textContent = new Intl.NumberFormat(navigator.language).format(currentCount);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          newStatsNumberElement.textContent = formattedTotal;
          statsSrElement!.textContent = `${formattedTotal} puzzles solved`;
        }
      }

      requestAnimationFrame(update);
    } catch (error) {
      console.warn("Could not load global stats:", error);
      statsTextElement.innerHTML = `<strong id="global-stats-number">—</strong> <span>puzzles solved</span>`;
      statsSrElement!.textContent = `— puzzles solved`;
    }
  }

  function init() {
    fetchGlobalStats();
    // Text content is now set in HTML, but keeping this for potential dynamic updates
    if (titleElement && !titleElement.textContent) {
      titleElement.textContent = `Ready to Solve?`;
    }
    if (descriptionElement && !descriptionElement.innerHTML) {
      descriptionElement.innerHTML = `Play <strong>4×4</strong> and <strong>9×9</strong> Sudoku puzzles.<br/>Test your logic. Beat the clock. Top the leaderboard!`;
    }
  }

  init();
});
