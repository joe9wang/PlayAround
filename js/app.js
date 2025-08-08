// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const roomId = "game-room-001";
const handRef = doc(db, "games", roomId);

document.querySelector("#my-hand").innerHTML = ['🔥', '💧', '🌪️'].map(card => {
  return `<button onclick="play('${card}')">${card}</button>`;
}).join('');

window.play = async (card) => {
  await setDoc(handRef, { latestCard: card });
};

onSnapshot(handRef, (docSnap) => {
  if (docSnap.exists()) {
    document.querySelector("#opponent-hand").textContent = "相手のカード：" + docSnap.data().latestCard;
  }
});
