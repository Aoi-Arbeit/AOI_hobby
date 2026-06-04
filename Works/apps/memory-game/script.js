/* === 神経衰弱ゲーム メインスクリプト === */
(() => {
  'use strict';

  /* === 絵柄プール (絵文字) === */
  const EMOJI_POOL = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🐧', '🐦', '🦄', '🐝', '🦋', '🐞', '🐢', '🐙',
    '🌸', '🌺', '🌻', '🌷', '🍀', '🍎', '🍇', '🍓',
    '🍕', '🍔', '🍟', '🍩', '🎂', '🍦', '☕', '🍺'
  ];

  /* === 難易度設定 === */
  const DIFFICULTY = {
    easy:    { cols: 4, rows: 3, name: 'かんたん', basePoints: 100 },
    normal:  { cols: 4, rows: 4, name: 'ふつう',   basePoints: 200 },
    hard:    { cols: 6, rows: 4, name: 'むずかしい', basePoints: 400 },
    expert:  { cols: 6, rows: 6, name: 'エキスパート', basePoints: 800 }
  };

  const FLIP_BACK_DELAY = 900; // ミスマッチ時に裏返すまでの時間(ms)

  /* === DOM 参照 === */
  const $ = (id) => document.getElementById(id);
  const els = {
    board: $('board'),
    difficulty: $('difficulty'),
    startBtn: $('startBtn'),
    timer: $('timer'),
    moves: $('moves'),
    score: $('score'),
    bestScore: $('bestScore'),
    modal: $('resultModal'),
    resultTime: $('resultTime'),
    resultMoves: $('resultMoves'),
    resultScore: $('resultScore'),
    newRecordRow: $('newRecordRow'),
    newRecordValue: $('newRecordValue'),
    retryBtn: $('retryBtn'),
    closeBtn: $('closeBtn')
  };

  /* === ゲーム状態 === */
  const state = {
    cards: [],            // {id, emoji, matched}
    flipped: [],          // 現在めくられているカード要素 (最大2)
    moves: 0,
    matched: 0,
    score: 0,
    elapsedMs: 0,
    timerId: null,
    startedAt: null,
    locked: false,
    currentDifficulty: 'normal'
  };

  /* === ユーティリティ === */
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const bestKey = (diff) => `memoryGame.best.${diff}`;

  const getBest = (diff) => {
    try {
      const raw = localStorage.getItem(bestKey(diff));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const setBest = (diff, value) => {
    try {
      localStorage.setItem(bestKey(diff), JSON.stringify(value));
    } catch (e) {
      // localStorage 利用不可でも続行
    }
  };

  /* === ベストスコア表示 === */
  const renderBest = () => {
    const best = getBest(state.currentDifficulty);
    if (best) {
      els.bestScore.textContent = `${best.score} (${formatTime(best.timeMs)})`;
    } else {
      els.bestScore.textContent = '-';
    }
  };

  /* === タイマー === */
  const startTimer = () => {
    state.startedAt = Date.now();
    state.elapsedMs = 0;
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.elapsedMs = Date.now() - state.startedAt;
      els.timer.textContent = formatTime(state.elapsedMs);
    }, 200);
  };

  const stopTimer = () => {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  };

  /* === スコア計算 ===
     基本: ペアマッチで難易度のbasePointsを加算
     ボーナス: 連続マッチでボーナス
     減点: ミスマッチで-10
  */
  let comboCount = 0;

  const onMatchScore = () => {
    comboCount++;
    const cfg = DIFFICULTY[state.currentDifficulty];
    const bonus = (comboCount - 1) * 50;
    state.score += cfg.basePoints + bonus;
    if (state.score < 0) state.score = 0;
    els.score.textContent = state.score;
  };

  const onMissScore = () => {
    comboCount = 0;
    state.score -= 10;
    if (state.score < 0) state.score = 0;
    els.score.textContent = state.score;
  };

  /* === カード生成 === */
  const buildCards = (diff) => {
    const cfg = DIFFICULTY[diff];
    const total = cfg.cols * cfg.rows;
    if (total % 2 !== 0) {
      throw new Error('カード総数は偶数である必要があります');
    }
    const pairCount = total / 2;
    if (pairCount > EMOJI_POOL.length) {
      throw new Error('絵柄プールが不足しています');
    }
    const picked = shuffle(EMOJI_POOL).slice(0, pairCount);
    const deck = shuffle([...picked, ...picked]).map((emoji, idx) => ({
      id: idx,
      emoji,
      matched: false
    }));
    return deck;
  };

  /* === レンダリング === */
  const renderBoard = () => {
    const cfg = DIFFICULTY[state.currentDifficulty];
    els.board.innerHTML = '';
    els.board.dataset.cols = cfg.cols;

    state.cards.forEach((card) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = card.id;
      el.dataset.emoji = card.emoji;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', '裏向きのカード');
      el.tabIndex = 0;

      el.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-back" aria-hidden="true"></div>
          <div class="card-face card-front">${card.emoji}</div>
        </div>
      `;

      el.addEventListener('click', () => onCardClick(el));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick(el);
        }
      });
      els.board.appendChild(el);
    });
  };

  /* === カードクリック処理 === */
  const onCardClick = (el) => {
    if (state.locked) return;
    if (el.classList.contains('flipped') || el.classList.contains('matched')) return;
    if (state.flipped.length >= 2) return;

    el.classList.add('flipped');
    el.setAttribute('aria-label', `表向き: ${el.dataset.emoji}`);
    state.flipped.push(el);

    if (state.flipped.length === 2) {
      state.moves++;
      els.moves.textContent = state.moves;
      checkMatch();
    }
  };

  /* === マッチ判定 === */
  const checkMatch = () => {
    const [a, b] = state.flipped;
    if (a.dataset.emoji === b.dataset.emoji) {
      // マッチ
      state.locked = true;
      setTimeout(() => {
        a.classList.add('matched');
        b.classList.add('matched');
        state.matched++;
        onMatchScore();
        state.flipped = [];
        state.locked = false;
        if (state.matched === state.cards.length / 2) {
          finishGame();
        }
      }, 250);
    } else {
      // ミスマッチ
      state.locked = true;
      a.classList.add('shake');
      b.classList.add('shake');
      onMissScore();
      setTimeout(() => {
        a.classList.remove('flipped', 'shake');
        b.classList.remove('flipped', 'shake');
        a.setAttribute('aria-label', '裏向きのカード');
        b.setAttribute('aria-label', '裏向きのカード');
        state.flipped = [];
        state.locked = false;
      }, FLIP_BACK_DELAY);
    }
  };

  /* === ゲーム終了 === */
  const finishGame = () => {
    stopTimer();
    state.elapsedMs = Date.now() - state.startedAt;

    // タイムボーナス: 早ければ早いほど高得点
    const cfg = DIFFICULTY[state.currentDifficulty];
    const idealSec = cfg.cols * cfg.rows * 2;
    const actualSec = state.elapsedMs / 1000;
    const timeBonus = Math.max(0, Math.floor((idealSec - actualSec) * 10));
    state.score += timeBonus;
    els.score.textContent = state.score;

    // ベスト更新判定
    const best = getBest(state.currentDifficulty);
    let isNewRecord = false;
    if (!best || state.score > best.score) {
      setBest(state.currentDifficulty, {
        score: state.score,
        timeMs: state.elapsedMs,
        moves: state.moves,
        date: new Date().toISOString()
      });
      isNewRecord = true;
    }

    // 結果モーダル表示
    els.resultTime.textContent = formatTime(state.elapsedMs);
    els.resultMoves.textContent = `${state.moves}回`;
    els.resultScore.textContent = `${state.score} (タイムボーナス +${timeBonus})`;

    if (isNewRecord) {
      els.newRecordRow.classList.remove('hidden');
      els.newRecordValue.classList.remove('hidden');
      els.newRecordValue.textContent = '🏆 ベスト更新';
    } else {
      els.newRecordRow.classList.add('hidden');
      els.newRecordValue.classList.add('hidden');
    }

    setTimeout(() => {
      els.modal.classList.remove('hidden');
      renderBest();
    }, 500);
  };

  /* === ゲーム開始 === */
  const startGame = () => {
    stopTimer();
    state.currentDifficulty = els.difficulty.value;
    state.cards = buildCards(state.currentDifficulty);
    state.flipped = [];
    state.moves = 0;
    state.matched = 0;
    state.score = 0;
    state.elapsedMs = 0;
    state.locked = false;
    comboCount = 0;

    els.moves.textContent = '0';
    els.score.textContent = '0';
    els.timer.textContent = '00:00';
    renderBest();
    renderBoard();
    startTimer();
  };

  /* === モーダル制御 === */
  const closeModal = () => {
    els.modal.classList.add('hidden');
  };

  /* === イベント登録 === */
  els.startBtn.addEventListener('click', startGame);
  els.retryBtn.addEventListener('click', () => {
    closeModal();
    startGame();
  });
  els.closeBtn.addEventListener('click', closeModal);
  els.difficulty.addEventListener('change', () => {
    state.currentDifficulty = els.difficulty.value;
    renderBest();
  });

  /* === 初期表示 === */
  renderBest();
})();
