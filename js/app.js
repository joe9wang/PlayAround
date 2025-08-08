
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let playerRole = "";

window.selectPlayer = function(role) {
  playerRole = role;
  document.getElementById("player-select").style.display = "none";
  document.getElementById("game-area").style.display = "block";

  const roomRef = doc(db, "games", "room-001");
  onSnapshot(roomRef, (docSnap) => {
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
      setDoc(doc(db, "games", "room-001"), { [playerRole + "_card"]: card }, { merge: true });
      img.remove(); // remove from hand after playing
    };
    myHand.appendChild(img);
  });
};
