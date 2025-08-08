
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let playerRole = "";
let roomId = "";
let roomRef;
let unsubscribe = () => {};

window.joinRoom = function () {
  const input = document.getElementById("room-id").value.trim();
  if (!input) return alert("ルームIDを入力してください");
  roomId = input;
  roomRef = doc(db, "games", roomId);

  document.getElementById("room-select").style.display = "none";
  document.getElementById("player-select").style.display = "block";
};

window.selectPlayer = function(role) {
  playerRole = role;
  document.getElementById("player-select").style.display = "none";
  document.getElementById("game-area").style.display = "block";

  unsubscribe(); // 前の監視解除
  unsubscribe = onSnapshot(roomRef, (docSnap) => {
    const data = docSnap.data();
    const opponentKey = playerRole === "player1" ? "player2_card" : "player1_card";
    const opponentCard = data?.[opponentKey] || "";
    document.getElementById("opponent-card").src = opponentCard ? "./images/" + opponentCard + ".png" : "";
  });

  const cards = ["fire", "water", "wind"];
  const myHand = document.getElementById("my-hand");
  myHand.innerHTML = "";
  cards.forEach(card => {
    const img = document.createElement("img");
    img.src = "./images/" + card + ".png";
    img.className = "card";
    img.onclick = () => {
      setDoc(roomRef, { [playerRole + "_card"]: card }, { merge: true });
      img.remove();
    };
    myHand.appendChild(img);
  });
};
