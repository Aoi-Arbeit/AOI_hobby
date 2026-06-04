import { auth } from "./firebase-config.js";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

window.onload = () => {
    const streak = localStorage.getItem('streakCount') || 0;
    document.getElementById('streakCount').innerText = streak;

    // ログインボタンのクリックイベント
    document.getElementById('login-btn').onclick = () => {
        signInWithPopup(auth, provider).catch(err => console.error(err));
    };

    // ログアウトボタンのクリックイベント
    document.getElementById('logout-btn').onclick = () => {
        signOut(auth);
    };

    // 認証状態の監視 (HTMLに直接書いていたものをここへ移動)
    onAuthStateChanged(auth, user => {
        const authSection = document.getElementById('auth-section');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        
        if (user) {
            authSection.style.display = 'none';
            userInfo.style.display = 'block';
            userName.textContent = user.displayName;
        } else {
            authSection.style.display = 'block';
            userInfo.style.display = 'none';
        }
    });
};