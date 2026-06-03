// 手の定義
const HANDS = [
    { name: "グー", emoji: "✊"},
    { name: "パー", emoji: "✋"},
    { name: "チョキ", emoji: "✌️"},
];

// スコア
let winCount = 0;
let loseCount = 0;
let drawCount = 0;

// 連勝・連敗
let winStreak = 0;
let loseStreak = 0;

// スコア表示
const elWinCount = document.getElementById('win-count');
const elLoseCount = document.getElementById('lose-count');
const elDrawCount = document.getElementById('draw-count');

// 連勝・連敗
const elStreakText = document.getElementById('streak-text');

// 手の表示
const elUserHand = document.getElementById('user-hand');
const elCpuHand = document.getElementById('cpu-hand');

// 結果
const elResultText = document.getElementById('result-text');

// ボタン
const handButtons = document.querySelectorAll('.hand-btn');
const elBtnReset = document.getElementById('btn-reset');

// CPUの手決定
const getRandomHand = () =>
    Math.floor(Math.random() * 3);

// 勝敗判定
const judge = (userChoice, cpuChoice) => {
    const diff = (userChoice - cpuChoice + 3) % 3;
    if (diff === 0) return "draw";
    else if (diff === 1) return "win";
    else return "lose";
}

// スコア更新
const updateScore = (result) => {
    if (result === "win") winCount++;
    else if (result === "lose") loseCount++;
    else drawCount++;

    elWinCount.textContent = winCount;
    elLoseCount.textContent = loseCount;
    elDrawCount.textContent = drawCount;
}

// 連勝・連敗更新
const updateStreak = (result) => {
    if (result === "win") {
        winStreak++;
        loseStreak = 0;
        elStreakText.textContent = `🔥${winStreak}連勝中！`;
        elStreakText.style.color = 'var(--color-win)';
    } else if (result === "lose") {
        loseStreak++;
        winStreak = 0;;
        elStreakText.textContent = `💦${loseStreak}連敗中...`;
        elStreakText.style.color = 'var(--color-lose)';
    } else {
        winStreak = 0;
        loseStreak = 0;
        elStreakText.textContent = "--引き分け--";
        elStreakText.style.color = 'var(--color-draw)';
    }
};

// メッセージ表示
const updateResult = (result, userChoice, cpuChoice) => {
    const messages = {
        win: "あなたの勝ち！🎉",
        lose: "あなたの負け...)>_<(",
        draw: "引き分け🤝",
    };
    const colors = {
        win: 'var(--color-win)',
        lose: 'var(--color-lose)',
        draw: 'var(--color-draw)',
    };

    // アニメーションをリセット
    elResultText.style.animation = "none";
    elResultText.offsetHeight;
    // リフロー
    elResultText.style.animation = " ";

    elResultText.textContent = messages[result];
    elResultText.style.color = colors[result];
};

// 手を絵文字で表示
const updateHands = (userChoice, cpuChoice) => {
    elUserHand.textContent = HANDS[userChoice].emoji;
    elCpuHand.textContent = HANDS[cpuChoice].emoji;
};

// ボタン設定
const clearHighlight = () => {
    handButtons.forEach(btn =>
        btn.classList.remove('selected')
    )
};
const highlightButton = (choice) => {
    clearHighlight();
    handButtons[choice].classList.add('selected');
};

// メイン関数
const playGame = (userChoice) => {
    const cpuChoice = getRandomHand();
    const result = judge(userChoice, cpuChoice);
    
    clearHighlight();
    highlightButton(userChoice);
    updateHands(userChoice, cpuChoice);
    updateResult(result);
    updateScore(result);
    updateStreak(result);
};

// リセットゲーム
const resetGame = () => {
    // 変数リセット
    winCount = loseCount = drawCount = 0;
    winStreak = loseStreak = 0;

    // 表示リセット
    elWinCount.textContent = 0;
    elLoseCount.textContent = 0;
    elDrawCount.textContent = 0;

    elStreakText.textContent = 'さあ、始めよう！';
    elStreakText.style.color = 'var(--color-text)';

    elUserHand.textContent = "?";
    elCpuHand.textContent = "?";
    
    elResultText.textContent = "手を選んでください";
    elResultText.style.color = 'var(--color-text)';

    clearHighlight();
};

// 手ボタン
handButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const choice = parseInt(btn.dataset.choice, 10);
        playGame(choice);
    });
});

// リセット
elBtnReset.addEventListener('click', resetGame);