import { auth , db } from "./firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

onAuthStateChanged(auth, async user => {
    if (user) {
        // アイコン画像を表示
        document.getElementById('user-icon').src = user.photoURL;

        // Firestoreからユーザーデータを取得して表示
        const DocRef = doc(db, "users", user.uid);
        const DocSnap = await getDoc(DocRef);
        if (DocSnap.exists()) {
            const data = DocSnap.data();
            document.getElementById('username').innerText = data.name || '名無し';
            document.getElementById('streakCount').innerText = data.streak || 0;
            document.getElementById('totalQuestions').innerText = data.totalQuestions || 0;
        } else {
            console.log("No such document!");
        }
    }
});

// --- 編集ボタンの制御 ---
const nameDisplay = document.getElementById('name-container');
const editForm = document.getElementById('edit-name-form');
const nameInput = document.getElementById('new-username');

document.getElementById('edit-name-btn').onclick = () => {
    nameInput.value = document.getElementById('username').innerText;
    nameDisplay.style.display = 'none';
    editForm.style.display = 'block';
};

document.getElementById('cancel-name-btn').onclick = () => {
    nameDisplay.style.display = 'block';
    editForm.style.display = 'none';
};

// --- 名前の保存処理 ---
document.getElementById('save-name-btn').onclick = async () => {
    const newName = nameInput.value;
    const user = auth.currentUser;

    if (user && newName) {
        try {
            // 1. Firebase Authentication上のプロフィールを更新
            await updateProfile(user, {
                displayName: newName
            });

            // 2. 画面の表示を更新
            document.getElementById('username').innerText = newName;
            nameDisplay.style.display = 'block';
            editForm.style.display = 'none';

            alert("ユーザー名を更新しました！");
        } catch (error) {
            console.error("更新エラー:", error);
            alert("更新に失敗しました。");
        }
    }
};