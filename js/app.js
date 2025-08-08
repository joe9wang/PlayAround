
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../firebaseConfig.js";
initializeApp(firebaseConfig);
const field = document.getElementById("field-container");
const input = document.getElementById("file-input");
const selectedView = document.getElementById("selected-card");
let myCards = [];

window.uploadImage = () => input.click();
input.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  addCard(url);
};

function addCard(src) {
  const card = document.createElement("img");
  card.src = src;
  card.className = "card";
  card.style.left = "100px";
  card.style.top = "100px";
  card.onclick = (e) => selectCard(card);
  card.onmousedown = dragStart;
  field.appendChild(card);
  myCards.push(card);
}

let selectedCard = null;
function selectCard(card) {
  if (selectedCard) selectedCard.classList.remove("selected");
  selectedCard = card;
  card.classList.add("selected");
  selectedView.innerHTML = "";
  const big = document.createElement("img");
  big.src = card.src;
  big.style.maxWidth = "90%";
  big.style.maxHeight = "90%";
  selectedView.appendChild(big);
}

function dragStart(e) {
  e.preventDefault();
  const card = e.target;
  const offsetX = e.offsetX;
  const offsetY = e.offsetY;
  const move = (ev) => {
    card.style.left = ev.clientX - offsetX + "px";
    card.style.top = ev.clientY - offsetY + "px";
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

window.flipAll = (faceDown) => {
  myCards.forEach(c => c.style.filter = faceDown ? "brightness(0.2)" : "");
};
window.arrangeCards = () => {
  myCards.forEach((c, i) => {
    c.style.left = 100 + i * 90 + "px";
    c.style.top = "100px";
  });
};
window.shuffleDeck = () => {
  const x = 200, y = 200;
  myCards.forEach((c, i) => {
    c.style.left = x + Math.random() * 10 + "px";
    c.style.top = y + Math.random() * 10 + "px";
  });
};
window.moveAll = (dx, dy) => {
  myCards.forEach(c => {
    c.style.left = (parseInt(c.style.left) + dx) + "px";
    c.style.top = (parseInt(c.style.top) + dy) + "px";
  });
};
