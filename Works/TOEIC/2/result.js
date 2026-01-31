// 結果画面でスコアを表示
window.onload = () => {
    //localStorageからスコアを取得
    const latestScore = localStorage.getItem("latestScore");
    const totalQuestions = localStorage.getItem("totalQuestions");

    //スコアを表示
    document.getElementById('score-value').innerText = `${latestScore} / ${totalQuestions}`;
}