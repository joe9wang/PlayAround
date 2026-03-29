import io

path = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js"

with io.open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Replace updateSessionIndicator
old_func = """function updateSessionIndicator() {
  if (!CURRENT_ROOM || !CURRENT_PLAYER) {
    sessionIndicator.textContent = 'ROOM: - / PLAYER: -';
    return;
  }
  const seatData = currentSeatMap[CURRENT_PLAYER];
  const defaultName = CURRENT_PLAYER === 'spectator' ? '観戦' : `P${CURRENT_PLAYER}`;
  const pName = seatData && seatData.displayName ? seatData.displayName : defaultName;
  sessionIndicator.textContent = `ROOM: ${CURRENT_ROOM} / PLAYER: ${pName}`;
}"""

new_func = """function updateSessionIndicator() {
  if (!CURRENT_ROOM || !CURRENT_PLAYER) {
    sessionIndicator.textContent = 'ROOM: - / PLAYER: -';
    return;
  }
  let pName = (playerNameInput.value || '').trim() || 'Guest';
  let seatDisplay = '観戦';
  if (CURRENT_PLAYER !== 'spectator') {
    const seatData = currentSeatMap[CURRENT_PLAYER];
    if (seatData && seatData.displayName) pName = seatData.displayName;
    seatDisplay = `P${CURRENT_PLAYER}`;
  }
  sessionIndicator.textContent = `ROOM: ${CURRENT_ROOM} / PLAYER: ${pName} / SEAT: ${seatDisplay}`;
  
  const sitBtn = document.getElementById('sit-seat-btn');
  const leaveBtn = document.getElementById('leave-seat-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');

  if (CURRENT_PLAYER === 'spectator') {
    if (sitBtn) sitBtn.style.display = 'block';
    if (leaveBtn) leaveBtn.style.display = 'none';
    if (leaveRoomBtn) leaveRoomBtn.style.display = IS_ROOM_CREATOR ? 'none' : 'block';
  } else {
    if (sitBtn) sitBtn.style.display = 'none';
    if (leaveBtn) leaveBtn.style.display = 'block';
    if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';
  }
}"""

if old_func in text:
    text = text.replace(old_func, new_func)
else:
    print("WARNING: old_func not found!")

# Append seat logic at the end
append_code = """

// ============================================
// Seat Selection & Spectator Logic
// ============================================

const sitSeatBtn = document.getElementById('sit-seat-btn');
const leaveSeatBtn = document.getElementById('leave-seat-btn');
const seatSelectModal = document.getElementById('seat-select-modal');
const seatSelectGrid = document.getElementById('seat-select-grid');
const seatSelectCancel = document.getElementById('seat-select-cancel');

if (sitSeatBtn) {
  sitSeatBtn.addEventListener('click', () => {
    if (!CURRENT_ROOM_META) return;
    const maxSeats = parseInt(CURRENT_ROOM_META.playerCount || 4, 10);
    seatSelectGrid.innerHTML = '';
    
    for (let i = 1; i <= maxSeats; i++) {
      const seatData = currentSeatMap[i];
      const hb = seatData && seatData.heartbeatAt && seatData.heartbeatAt.toMillis ? seatData.heartbeatAt.toMillis() : 0;
      const isUsed = !!(seatData && seatData.claimedByUid && (Date.now() - hb) <= SEAT_STALE_MS);
      
      const btn = document.createElement('button');
      btn.className = 'seat-btn';
      if (isUsed) {
        btn.classList.add('active');
        btn.disabled = true;
        btn.textContent = `P${i} (満席)`;
        btn.style.opacity = '0.5';
      } else {
        btn.textContent = `P${i}`;
      }
      btn.dataset.seat = i;
      
      btn.addEventListener('click', async () => {
        if (isUsed) return;
        seatSelectModal.style.display = 'none';
        
        try { await showRoomInterstitial({ force: true, cooldownMs: 0 }); } catch (_) { }
        
        const ok = await claimSeat(CURRENT_ROOM, i);
        if (!ok) { alert(`P${i} はいま埋まりました。別の座席を選んでください。`); return; }
        
        CURRENT_PLAYER = i;
        document.body.classList.remove('is-spectator');
        startHeartbeat(CURRENT_ROOM, i);
        subscribeHP(CURRENT_ROOM);
        renderHPPanel();
        updateSessionIndicator();
        updateEndRoomButtonVisibility();
        updateLeaveRoomButtonVisibility();
        applyOtherOpsUI();
        
        // Host takes seat, we might want to update room doc if they are host
        const isHost = CURRENT_ROOM_META?.hostUid === CURRENT_UID;
        if (isHost) {
          try {
            await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { hostSeat: i, updatedAt: serverTimestamp() }, { merge: true });
          } catch(e) {}
        }
      });
      
      seatSelectGrid.appendChild(btn);
    }
    seatSelectModal.style.display = 'flex';
  });
}

if (seatSelectCancel) {
  seatSelectCancel.addEventListener('click', () => {
    seatSelectModal.style.display = 'none';
  });
}

if (leaveSeatBtn) {
  leaveSeatBtn.addEventListener('click', async () => {
    if (CURRENT_PLAYER === 'spectator') return;
    if (!confirm('座席から離れて観戦者に戻りますか？')) return;
    
    try { await showRoomInterstitial({ force: true, cooldownMs: 0 }); } catch (_) { }
    
    const oldSeat = CURRENT_PLAYER;
    CURRENT_PLAYER = 'spectator';
    document.body.classList.add('is-spectator');
    updateSessionIndicator();
    updateEndRoomButtonVisibility();
    updateLeaveRoomButtonVisibility();
    applyOtherOpsUI();
    renderHPPanel();
    
    try { stopHeartbeat(); } catch (_) { }
    try {
      if (CURRENT_ROOM) {
         await releaseSeat(db, CURRENT_ROOM, oldSeat, CURRENT_UID, CURRENT_ROOM_META?.hostUid || null);
      }
    } catch(e) {}
    
    const isHost = CURRENT_ROOM_META?.hostUid === CURRENT_UID;
    if (isHost && CURRENT_ROOM) {
      try {
        await setDoc(doc(db, `rooms/${CURRENT_ROOM}`), { hostSeat: null, updatedAt: serverTimestamp() }, { merge: true });
      } catch(e) {}
    }
    
  });
}
"""

if "// Seat Selection & Spectator Logic" not in text:
    text += "\n" + append_code
else:
    print("WARNING: seat logic already appended!")

with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(text)

print("done")
