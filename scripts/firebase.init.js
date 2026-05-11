// ====================================================================
// firebase.init.js — Firebase 初期化
// Firebase App, App Check, Auth, Firestore, Storage を初期化し、export する。
// ====================================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-check.js";

import {
    getAuth, signInAnonymously, onAuthStateChanged,
    GoogleAuthProvider,
    EmailAuthProvider, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
    signInWithPopup, linkWithPopup, signInWithCredential, linkWithCredential,
    signInWithRedirect, linkWithRedirect, getRedirectResult,
    signOut, updateProfile, onIdTokenChanged, getIdToken,
    getAdditionalUserInfo, deleteUser, applyActionCode
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
    getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot,
    serverTimestamp, runTransaction, deleteDoc, collection, limit,
    addDoc, where, query, getDocs, writeBatch, Timestamp, orderBy, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
    getStorage, ref, uploadString, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

import { setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ===== Firebase Config =====
const firebaseConfig = {
    apiKey: "AIzaSyCy-r6L1NgyHcqvsfpkyNPDJq9uMvv2CMM",
    authDomain: "cardgame-f484c.firebaseapp.com",
    projectId: "cardgame-f484c",
    storageBucket: "cardgame-f484c.firebasestorage.app",
    messagingSenderId: "248859224605",
    appId: "1:248859224605:web:1320093856bc1861c174f4"
};

const app = initializeApp(firebaseConfig);

// ===== App Check (reCAPTCHA v3) =====
if (typeof window !== "undefined") {
    const siteKey = "6LeClaQrAAAAADNTifrjqIOT9_blqXBv8bDkGIHC";
    if (siteKey && !siteKey.startsWith("__")) {
        try {
            const appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(siteKey),
                isTokenAutoRefreshEnabled: true
            });
            window.appCheck = appCheck;
            console.log('[AppCheck] initialized');
        } catch (e) {
            console.warn('[AppCheck] init failed; continuing without it', e);
        }
    }
}

console.log('apps:', getApps().length);
getToken(window.appCheck)
    .then(t => console.log('AppCheck token OK', !!t.token))
    .catch(e => console.error('AppCheck error', e));

// ===== Auth / Firestore / Storage =====
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

const db = getFirestore(app);

const storageBucket = firebaseConfig.storageBucket;
const storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app);

// ===== Export =====
export { app, auth, db, storage };

// Re-export Firebase SDK functions for use by other modules
export {
    // Auth
    signInAnonymously, onAuthStateChanged,
    GoogleAuthProvider,
    EmailAuthProvider, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
    signInWithPopup, linkWithPopup, signInWithCredential, linkWithCredential,
    signInWithRedirect, linkWithRedirect, getRedirectResult,
    signOut, updateProfile, onIdTokenChanged, getIdToken,
    getAdditionalUserInfo, deleteUser, applyActionCode,
    // Firestore
    doc, setDoc, getDoc, updateDoc, onSnapshot,
    serverTimestamp, runTransaction, deleteDoc, collection, limit,
    addDoc, where, query, getDocs, writeBatch, Timestamp, orderBy, getCountFromServer,
    // Storage
    ref, uploadString, uploadBytes, getDownloadURL
};
