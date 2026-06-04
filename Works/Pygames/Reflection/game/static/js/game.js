// ===========================
// ゲームの基本設定
// ===========================

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score-display");
const startBtn = document.getElementById("start-btn");

let score = 0;
let isRunning = false;
let animationId = null;

// ===========================
// ゲーム状態
// ===========================

const gameState = {
  score: 0,
  level: 1,
};

// ===========================
// サーバーとの通信
// ===========================

async function fetchState() {
  const res = await fetch("/api/state");
  const data = await res.json();
  return data;
}

async function sendAction(action) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return await res.json();
}

// ===========================
// ゲームループ
// ===========================

function update() {
  // TODO: ゲームロジックを更新する
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // TODO: 描画処理を実装する
  ctx.fillStyle = "#e94560";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("ゲームコンテンツをここに描画", canvas.width / 2, canvas.height / 2);
}

function gameLoop() {
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

// ===========================
// 初期化 & イベント
// ===========================

startBtn.addEventListener("click", async () => {
  if (isRunning) {
    // ゲームを止める
    cancelAnimationFrame(animationId);
    isRunning = false;
    startBtn.textContent = "ゲームスタート";
  } else {
    // ゲームを開始する
    const state = await fetchState();
    gameState.score = state.score;
    gameState.level = state.level;
    isRunning = true;
    startBtn.textContent = "ゲームを止める";
    gameLoop();
  }
});

// スコア更新ヘルパー
function updateScore(points) {
  gameState.score += points;
  scoreDisplay.textContent = `スコア: ${gameState.score}`;
}
