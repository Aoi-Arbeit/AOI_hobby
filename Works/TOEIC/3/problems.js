// 配列をシャッフルする共通関数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

//問題データ
let questions = [];

async function loadQuestions() {
    try {
        const response = await fetch('questions/test.json');
        const data = await response.json();

        //問題データを格納
        questions = data;

        //各問題の選択肢をシャッフル
        questions.forEach(q => {
            const correctOption = q.options[q.answer];
            q.options = shuffleArray(q.options);
            q.answer = q.options.indexOf(correctOption);
        });

        //データ取得後に表示を初期化
        init();
    } catch (error) {
        console.error("Error loading questions:", error);
    }
}
loadQuestions();

let currentIdx = 0;
let score = 0;
const correctSound = new Audio('music/correct.mp3');
const incorrectSound = new Audio('music/incorrect.mp3');
let sessionResults = [];

//画面に問題を表示する関数
function displayQuestion() {
    document.getElementById('answer-section').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('result-btn').style.display = 'inline-block';

    const qData = questions[currentIdx];
    //HTMLの要素を書き換える
    const questionText = document.getElementById('question-text');
    questionText.innerText = qData.q;
    questionText.setAttribute('data-id', qData.id);

    const listItems = document.querySelectorAll('li');
    listItems.forEach((li, index) => {
        li.innerText = qData.options[index];

        //状態のリセット
        li.style.textDecoration = "none";
        li.style.opacity = "1.0";
        li.style.pointerEvents = "auto";
        li.style.cursor = "pointer";
        li.style.backgroundColor = "white";

        //左クリック　回答
        li.onclick = () => checkAnswer(index);

        //右クリック 斜線
        li.oncontextmenu = (e) => {
            //右クリックのデフォルトメニューを無効化
            e.preventDefault();

            //斜線のON/OFF切り替え
            if (li.style.textDecoration === "line-through") {
                li.style.textDecoration = "none";
                li.style.opacity = "1.0";
            } else {
                li.style.textDecoration = "line-through";
                li.style.opacity = "0.5";
            }
        }
    });
}

//回答をチェックする関数
function checkAnswer(selected) {
    // 回答表示セクションを表示
    const qData = questions[currentIdx];
    const resultLabel = document.getElementById('result-label');
    const correctAnswerText = document.getElementById('answer-text');
    const explanationText = document.getElementById('explanation-text');
    const isCorrect = (selected === questions[currentIdx].answer);

    // 1. 正解・不正解の判定とラベルの色変え
    if (isCorrect) {
        resultLabel.innerText = "⭕️ Correct!";
        resultLabel.style.color = "green";

        // 正解の選択肢に色をつける
        const listItems = document.querySelectorAll('li');
        listItems[selected].style.backgroundColor = "lightgreen";

        // 正解音を再生
        correctSound.currentTime = 0;
        correctSound.play();

        // スコアを増やす
        score++;
    } else {
        resultLabel.innerText = "❌ Incorrect...";
        resultLabel.style.color = "red";

        // 不正解の選択肢に色をつける
        const listItems = document.querySelectorAll('li');
        listItems[selected].style.backgroundColor = "lightcoral";

        // 正解の選択肢に色をつける
        listItems[qData.answer].style.backgroundColor = "lightgreen";

        // 不正解音を再生
        incorrectSound.currentTime = 0;
        incorrectSound.play();
    }

    // セッション結果に正解を記録
    sessionResults.push({ 
        id: qData.id,
        isCorrect: isCorrect,
        level: 5,
        date: new Date().toISOString()
    })

    // 2. 回答解説の表示
    correctAnswerText.innerText = qData.options[qData.answer];
    explanationText.innerText = qData.explanation;

    // 3. 回答セクションを表示
    document.getElementById('answer-section').style.display = 'block';

    // 4. 次の問題へ進むボタンを表示
    if (currentIdx < questions.length - 1) {
        document.getElementById('next-btn').style.display = 'inline-block';
    }

    // 5. 2重回答防止
    const listItems = document.querySelectorAll('li');
    listItems.forEach(li => {
        li.style.pointerEvents = "none";
        li.style.cursor = "default";
    });
}

//次の問題へ進む関数
function setupNextButton() {
    const button = document.getElementById('next-btn');
    button.onclick = () => {
        currentIdx++;
        if (currentIdx < questions.length) {
            displayQuestion();
            updateProgressBar();
        }
    };
}

// 結果画面へ遷移する関数
function setupResultButton() {
    const button = document.getElementById('result-btn');
    button.onclick = () => {
        localStorage.setItem("latestScore", score);
        localStorage.setItem("totalQuestions", currentIdx + 1);
        
        // セッション結果をローカルストレージに保存
        localStorage.setItem("sessionResults", JSON.stringify(sessionResults));

        window.location.href = "result.html";
    };
}

//プログレスバー更新
function updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    const progressPercent = ((currentIdx) / questions.length) * 100;
    progressBar.style.width = progressPercent + "%";
}

//初期化
function init() {
    if (document.getElementById('question-text')) {
        displayQuestion();
        updateProgressBar();
        setupNextButton();
        setupResultButton();
    }
}
init();