const socket = io();

const redScore = document.querySelector(".score-panel-red .score");
const blueScore = document.querySelector(".score-panel-blue .score");

socket.on("competition/1", (scores) => {
  if (!redScore || !blueScore || !scores || typeof scores !== "object") {
    return;
  }

  if (Object.hasOwn(scores, "oponent_a")) {
    redScore.textContent = scores.oponent_a;
  }

  if (Object.hasOwn(scores, "oponent_b")) {
    blueScore.textContent = scores.oponent_b;
  }
});
