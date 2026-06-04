import { auth, db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// 1. まずストリークの計算を実行（LocalStorage更新）
updateStreak();

// 2. 認証状態を監視して、ログインしていれば画面表示と保存を行う
onAuthStateChanged(auth, async (user) => {
    // ローカルストレージからデータを取得
    const latestScore = localStorage.getItem("latestScore") || 0;
    const totalQuestions = localStorage.getItem("totalQuestions") || 0;
    const streakCount = localStorage.getItem("streakCount") || 0;

    // スコアの表示
    const scoreElement = document.getElementById("score-value");
    if (scoreElement) {
        scoreElement.innerText = `${latestScore} / ${totalQuestions}`;
    }

    // 解いた問題IDと正誤を保存する関数
    const detailedResults = JSON.parse(localStorage.getItem("sessionResults")) || [];
    console.log("セッション結果:", detailedResults);

    if (user) {
        try {
            // Firestoreへの保存
            const historyToAdd = detailedResults.map(result => ({
                questionId: result.id,
                isCorrect: result.isCorrect,
                level: result.level,
                date: result.date
            }));



            await setDoc(doc(db, "users", user.uid), {
                totalQuestions: Number(totalQuestions),
                streak: Number(streakCount),
                last_played: serverTimestamp(),
                history: arrayUnion(...historyToAdd)
            }, { merge: true });
            console.log("クラウド保存完了！");

            // 保存後にローカルストレージのセッション結果をクリア
            localStorage.removeItem("sessionResults")
        } catch (error) {
            console.error("保存エラー:", error);
        }
    } else {
        console.log("ログインしていないため保存をスキップしました");
    }
});

// 連続日数を更新する関数
function updateStreak() {
    const now = new Date();
    const todayStr = now.toDateString();
    const lastDateStr = localStorage.getItem('lastDate');
    let streakCount = parseInt(localStorage.getItem('streakCount')) || 0;

    if (lastDateStr !== todayStr) {
        if (lastDateStr) {
            const lastDate = new Date(lastDateStr);
            // 差分が24時間〜48時間以内なら継続、それ以上ならリセット
            const diffTime = now.setHours(0,0,0,0) - lastDate.setHours(0,0,0,0);
            const oneDay = 1000 * 60 * 60 * 24;

            if (diffTime === oneDay) {
                streakCount++;
            } else {
                streakCount = 1;
            }
        } else {
            streakCount = 1;
        }
        localStorage.setItem('streakCount', streakCount);
        localStorage.setItem('lastDate', todayStr);
    }
}