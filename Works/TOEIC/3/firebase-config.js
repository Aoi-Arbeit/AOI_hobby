// Import the functions you need from the SDKs you need
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
        import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
        import {
            getAuth,
            GoogleAuthProvider,
            signInWithPopup,
            signOut,
            onAuthStateChanged
        } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
        import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
        // TODO: Add SDKs for Firebase products that you want to use
        // https://firebase.google.com/docs/web/setup#available-libraries

        // Your web app's Firebase configuration
        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
        const firebaseConfig = {
            apiKey: "AIzaSyBqAuGv8ggPL62aX-5t1mbky-0UIClsauQ",
            authDomain: "my-toeic-app.firebaseapp.com",
            projectId: "my-toeic-app",
            storageBucket: "my-toeic-app.firebasestorage.app",
            messagingSenderId: "151297138281",
            appId: "1:151297138281:web:38dc727b21dcff478a0cf8",
            measurementId: "G-BVJBV04H8P"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        export const analytics = getAnalytics(app);
        export const auth = getAuth(app);
        export const provider = new GoogleAuthProvider();
        export const db = getFirestore(app);