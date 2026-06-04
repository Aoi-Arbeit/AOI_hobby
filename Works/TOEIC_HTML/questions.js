// --- 共通・ユーティリティ ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- 状態管理 ---
let questions = [];
let currentIdx = 0;
let score = 0;
let sessionResults = [];

const correctSound = new Audio('assets/correct.mp3');
const incorrectSound = new Audio('assets/incorrect.mp3');

// --- DOM要素のキャッシュ (何度も使うものは変数に入れておく) ---
const el = {
    questionText: () => document.getElementById('question-text'),
    optionsList: () => document.getElementById('options-list'),
    feedbackArea: () => document.getElementById('feedback-area'),
    resultLabel: () => document.getElementById('result-label'),
    answerText: () => document.getElementById('answer-text'),
    explanationText: () => document.getElementById('explanation-text'),
    nextBtn: () => document.getElementById('next-btn'),
    resultBtn: () => document.getElementById('result-btn'),
    skipBtn: () => document.getElementById('skip-btn'),
    progressBar: () => document.getElementById('progress-bar'),
    currentNum: () => document.getElementById('current-num'),
    totalNum: () => document.getElementById('total-num')
};

// --- 問題データの読み込み ---
window.onload = loadQuestions;
async function loadQuestions() {
    try {
        const response = await fetch('questions/test.json');
        const data = await response.json();

        questions = data.map(q => {
            const correctOption = q.options[q.answer];
            const shuffled = shuffleArray([...q.options]);
            return {
                ...q,
                options: shuffled,
                answer: shuffled.indexOf(correctOption)
            };
        });

        init();
    } catch (error) {
        console.error("Error loading questions:", error);
    }
}

// --- クイズの表示更新 ---
function displayQuestion() {
    const qData = questions[currentIdx];
    
    // 表示のリセット
    el.feedbackArea().style.display = 'none';
    el.nextBtn().style.display = 'none';
    el.resultBtn().style.display = 'none';
    el.skipBtn().style.display = 'inline-block';
    el.currentNum().innerText = currentIdx + 1;
    el.totalNum().innerText = questions.length;

    // 問題テキスト設定
    el.questionText().innerText = qData.q;
    
    // 選択肢の生成 (HTMLに直書きせずJSで生成すると柔軟)
    el.optionsList().innerHTML = ''; 
    qData.options.forEach((opt, idx) => {
        const li = document.createElement('li');
        li.innerText = opt;
        li.className = 'option-item'; // CSSでデザインしやすく
        
        // 回答イベント
        li.onclick = () => checkAnswer(idx);
        
        // 右クリック(斜線)イベント
        li.oncontextmenu = (e) => {
            e.preventDefault();
            li.classList.toggle('eliminated'); // classで制御
        };
        
        el.optionsList().appendChild(li);
    });

    updateProgressBar();
}

// --- 正誤判定 ---
function checkAnswer(selectedIdx) {
    const qData = questions[currentIdx];
    const isCorrect = selectedIdx === qData.answer;
    const listItems = el.optionsList().querySelectorAll('li');

    // 2重回答防止
    listItems.forEach(li => li.style.pointerEvents = "none");

    // 結果の記録
    if (isCorrect) {
        score++;
        el.resultLabel().innerText = "⭕️ Correct!";
        el.resultLabel().style.color = "green";
        correctSound.play();
    } else {
        el.resultLabel().innerText = "❌ Incorrect...";
        el.resultLabel().style.color = "red";
        listItems[selectedIdx].classList.add('wrong-selection');
        incorrectSound.play();
    }
    
    // 正解の選択肢を強調
    listItems[qData.answer].classList.add('correct-selection');

    // 解説の表示
    el.answerText().innerText = qData.options[qData.answer];
    el.explanationText().innerText = qData.explanation;
    el.feedbackArea().style.display = 'block';

    // セッション保存用
    sessionResults.push({
        id: qData.id,
        isCorrect,
        level: qData.level || 5,
        date: new Date().toISOString()
    });

    // 次へ or 結果ボタンの制御
    if (currentIdx < questions.length - 1) {
        el.nextBtn().style.display = 'inline-block';
        el.resultBtn().style.display = 'inline-block';
        el.skipBtn().style.display = 'none';
    } else {
        el.resultBtn().style.display = 'inline-block';
    }
}

// --- プログレスバー ---
function updateProgressBar() {
    const percent = (currentIdx / questions.length) * 100;
    el.progressBar().style.width = `${percent}%`;
}

// --- 初期化とイベント登録 ---
function init() {
    displayQuestion();

    // 共通の保存・遷移処理
    const finishQuiz = (total) => {
        localStorage.setItem("latestScore", score);
        localStorage.setItem("totalQuestions", total);
        localStorage.setItem("sessionResults", JSON.stringify(sessionResults));
        window.location.href = "result.html";
    };

    // 次の問題へ
    el.nextBtn().onclick = () => {
        currentIdx++;
        displayQuestion();
    };

    // 最後まで解いて結果表示
    el.resultBtn().onclick = () => finishQuiz(questions.length);

    // 途中でスキップして結果表示
    el.skipBtn().onclick = () => {
        // 解いた問題数（sessionResultsの数）を分母にするのが一般的
        const answeredCount = sessionResults.length;
        finishQuiz(answeredCount);
    };
}

// 実行
loadQuestions();