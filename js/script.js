// Firebaseとの接続やリアルタイム同期の処理
let roomId = null;
let playerNumber = null;
let currentCards = {};
let selectedCardId = null;

// DOM要素の取得
const loginScreen = document.getElementById('login-screen');
const playScreen = document.getElementById('play-screen');
const roomIdInput = document.getElementById('room-id-input');
const joinRoomButton = document.getElementById('join-room-button');
const playerSelection = document.getElementById('player-selection');
const fileInput = document.getElementById('file-input');
const field = document.getElementById('field');
const previewImg = document.getElementById('preview-img');

// ログイン処理
joinRoomButton.addEventListener('click', () => {
    roomId = roomIdInput.value.trim();
    if (roomId) {
        // Firebaseで部屋の存在を確認
        database.ref(`rooms/${roomId}`).once('value', snapshot => {
            if (!snapshot.exists()) {
                database.ref(`rooms/${roomId}`).set({ players: {} });
            }
            playerSelection.style.display = 'block';
        });
    }
});

// プレイヤー選択
function selectPlayer(pNum) {
    playerNumber = pNum;
    // Firebaseにプレイヤーとして参加を登録
    const playerRef = database.ref(`rooms/${roomId}/players/player${playerNumber}`);
    playerRef.set({ name: `Player ${playerNumber}` })
        .then(() => {
            loginScreen.style.display = 'none';
            playScreen.style.display = 'block';
            listenForRoomChanges();
        });
}

// リアルタイムリスナー
function listenForRoomChanges() {
    const roomRef = database.ref(`rooms/${roomId}/cards`);
    roomRef.on('value', snapshot => {
        currentCards = snapshot.val() || {};
        renderCards();
    });
}

// カードのレンダリング
function renderCards() {
    // 既存のカードをすべて削除
    document.querySelectorAll('.card').forEach(card => card.remove());
    
    for (const cardId in currentCards) {
        const cardData = currentCards[cardId];
        const card = document.createElement('div');
        card.className = 'card';
        card.id = cardId;
        card.style.left = `${cardData.x}px`;
        card.style.top = `${cardData.y}px`;
        card.style.zIndex = cardData.z;
        
        if (cardData.isFaceDown) {
            card.classList.add('card-back');
        } else {
            const img = document.createElement('img');
            img.src = cardData.image;
            card.appendChild(img);
        }
        
        // カードのドラッグ＆ドロップイベント
        card.addEventListener('mousedown', (e) => {
            // 他プレイヤーのカードは動かせない [cite: 4]
            if (cardData.owner !== playerNumber) return;
            // 選択状態にする
            selectCard(cardId);
            
            let shiftX = e.clientX - card.getBoundingClientRect().left;
            let shiftY = e.clientY - card.getBoundingClientRect().top;
            
            function moveAt(pageX, pageY) {
                card.style.left = pageX - shiftX + 'px';
                card.style.top = pageY - shiftY + 'px';
            }

            function onMouseMove(event) {
                moveAt(event.pageX, event.pageY);
            }

            document.addEventListener('mousemove', onMouseMove);
            
            card.onmouseup = function() {
                document.removeEventListener('mousemove', onMouseMove);
                card.onmouseup = null;
                // 位置をFirebaseに保存
                database.ref(`rooms/${roomId}/cards/${cardId}`).update({
                    x: parseInt(card.style.left),
                    y: parseInt(card.style.top),
                    z: Date.now() // 重なったときに手前に来るようにz-indexを更新 [cite: 4]
                });
            };
        });
        
        // カードの右クリックで表裏を切り替える [cite: 4]
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            database.ref(`rooms/${roomId}/cards/${cardId}`).update({
                isFaceDown: !cardData.isFaceDown
            });
        });
        
        field.appendChild(card);
    }
}

// カードの選択機能
function selectCard(cardId) {
    if (selectedCardId) {
        document.getElementById(selectedCardId).classList.remove('selected');
        previewImg.style.display = 'none';
    }
    
    selectedCardId = cardId;
    const selectedCard = document.getElementById(selectedCardId);
    selectedCard.classList.add('selected');
    
    // プレビューパネルに画像を表示 [cite: 59]
    const imgElement = selectedCard.querySelector('img');
    if (imgElement) {
        previewImg.src = imgElement.src;
        previewImg.style.display = 'block';
    }
}

// カード画像のアップロード
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
            const newCardId = database.ref(`rooms/${roomId}/cards`).push().key;
            database.ref(`rooms/${roomId}/cards/${newCardId}`).set({
                owner: playerNumber,
                image: e.target.result,
                isFaceDown: false,
                x: 0, // プレイヤーのデッキエリアに出現 
                y: 0,
                z: Date.now()
            });
        };
        reader.readAsDataURL(file);
    }
});

// ゲームフィールドのパン機能 [cite: 4]
let isPanning = false;
let startX, startY, scrollLeft, scrollTop;

field.parentElement.addEventListener('mousedown', (e) => {
    // カード以外の場所でのみパン機能を発動
    if (e.target.classList.contains('card')) return;
    
    isPanning = true;
    startX = e.pageX - field.parentElement.offsetLeft;
    startY = e.pageY - field.parentElement.offsetTop;
    scrollLeft = field.parentElement.scrollLeft;
    scrollTop = field.parentElement.scrollTop;
});

field.parentElement.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const x = e.pageX - field.parentElement.offsetLeft;
    const y = e.pageY - field.parentElement.offsetTop;
    const walkX = x - startX;
    const walkY = y - startY;
    field.parentElement.scrollLeft = scrollLeft - walkX;
    field.parentElement.scrollTop = scrollTop - walkY;
});

field.parentElement.addEventListener('mouseup', () => {
    isPanning = false;
});

// マウスホイールでのズーム機能 [cite: 4]
field.parentElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 0.9 : 1.1;
    const currentTransform = field.style.transform || 'scale(1)';
    const currentScale = parseFloat(currentTransform.match(/scale\((.*?)\)/)[1]);
    const newScale = currentScale * scale;
    field.style.transform = `scale(${newScale})`;
});


// 左サイドバーの操作パネル機能 [cite: 60]
function faceDownAll() {
    const myCards = Object.keys(currentCards).filter(key => currentCards[key].owner === playerNumber);
    myCards.forEach(cardId => {
        database.ref(`rooms/${roomId}/cards/${cardId}`).update({ isFaceDown: true });
    });
}

function faceUpAll() {
    const myCards = Object.keys(currentCards).filter(key => currentCards[key].owner === playerNumber);
    myCards.forEach(cardId => {
        database.ref(`rooms/${roomId}/cards/${cardId}`).update({ isFaceDown: false });
    });
}

function shuffleDecks() {
    const myCardsInDeck = Object.keys(currentCards).filter(key => {
        const cardData = currentCards[key];
        // デッキエリアにあるカードの判定（ここでは簡易的に）
        return cardData.owner === playerNumber && cardData.inDeckArea;
    });

    if (myCardsInDeck.length > 0) {
        const deckPosition = { x: 100, y: 100 }; // デッキエリアの中心座標
        // ランダムな順序に並び替える
        const shuffledCards = myCardsInDeck.sort(() => Math.random() - 0.5);
        shuffledCards.forEach((cardId, index) => {
            database.ref(`rooms/${roomId}/cards/${cardId}`).update({
                x: deckPosition.x,
                y: deckPosition.y,
                z: Date.now() + index // 重なったときに順番がランダムになるようにz-indexを更新
            });
        });
    }
}

function alignDecks() {
    // 自分のカードをプレイヤーエリアに整列させるロジックを実装
}

function shiftAllCards(dx, dy) {
    const myCards = Object.keys(currentCards).filter(key => currentCards[key].owner === playerNumber);
    myCards.forEach(cardId => {
        const currentPos = currentCards[cardId];
        database.ref(`rooms/${roomId}/cards/${cardId}`).update({
            x: currentPos.x + dx,
            y: currentPos.y + dy
        });
    });
}

// カードのコピーガード [cite: 52, 54]
document.addEventListener('contextmenu', e => {
  if (e.target.closest('.card img')) {
    e.preventDefault();
  }
});