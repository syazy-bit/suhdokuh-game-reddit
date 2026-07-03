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

  function init() {
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
