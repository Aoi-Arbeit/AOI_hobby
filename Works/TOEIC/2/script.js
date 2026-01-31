//問題データ
const questions = [
    {
        q: "The supervisor ______ the proposal before the meeting.",
        options: ["reviewed", "reviews", "reviewing", "reviewer"],
        answer: 0,
        explanation: "過去の出来事（before the meeting）について述べているため、過去形のreviewedが適切です。"
    },
    {
        q: "The new software is ______ than the old one.",
        options: ["fast", "faster", "fastest", "fastly"],
        answer: 1,
        explanation: "thanがあるため比較級を用います。fastの比較級はfasterです。"
    }
];

let currentIdx = 0;
let score = 0;

//画面に問題を表示する関数
function displayQuestion() {
    document.getElementById('answer-section').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('result-btn').style.display = 'none';

    const qData = questions[currentIdx];
    //HTMLの要素を書き換える
    document.getElementById('question-text').innerText = qData.q;

    const listItems = document.querySelectorAll('li');
    listItems.forEach((li, index) => {
        li.innerText = qData.options[index];

        //状態のリセット
        li.style.textDecoration = "none";
        li.style.opacity = "1.0";

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

    // 1. 正解・不正解の判定とラベルの色変え
    if (selected === qData.answer) {
        resultLabel.innerText = "⭕️ Correct!";
        resultLabel.style.color = "green";

        // スコアを増やす
        score++;
    } else {
        resultLabel.innerText = "❌ Incorrect...";
        resultLabel.style.color = "red";
    }

    // 2. 回答解説の表示
    correctAnswerText.innerText = qData.options[qData.answer];
    explanationText.innerText = qData.explanation;

    // 3. 回答セクションを表示
    document.getElementById('answer-section').style.display = 'block';

    // 4. 次の問題へ進むボタンを表示
    if (currentIdx < questions.length - 1) {
        document.getElementById('next-btn').style.display = 'inline-block';
    } else {
        document.getElementById('result-btn').style.display = "inline-block";
    }
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
        localStorage.setItem("totalQuestions", questions.length);
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
displayQuestion();
//初期化
if (document.getElementById('question-text')) {
    displayQuestion();
    setupNextButton();
    setupResultButton();
}