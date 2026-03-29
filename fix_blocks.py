import io
import re

path = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js"

with io.open(path, "r", encoding="utf-8") as f:
    text = f.read()

def normalize_ws(s):
    return re.escape(s).replace(r'\ ', r'\s+').replace(r'\n', r'\s+')

# Block 1
b1_t = """  if (!id) { alert(t('err.roomId')); return; }
  if (!creatorName) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }
  if (!CREATE_SELECTED_SEAT) { alert(t('err.seat')); return; }
  if (CREATE_SELECTED_SEAT === 'spectator') { alert('観戦モードで新しいルームを作成することはできません。'); return; }"""
b1_r = """  if (!id) { alert(t('err.roomId')); return; }\n  if (!creatorName) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }"""
text = re.sub(normalize_ws(b1_t), b1_r, text)

# Block 2
b2_t = """    joinRoomInput.value = id;
    loadSeatStatus();
    const ok = await claimSeat(id, CREATE_SELECTED_SEAT);
    if (!ok) { alert(`P${CREATE_SELECTED_SEAT} は使用中でした。別の座席を選んでください。`); return; }
    await setDoc(doc(db, `rooms/${id}`), { hostSeat: CREATE_SELECTED_SEAT, updatedAt: serverTimestamp() }, { merge: true });
    currentSeatMap[CREATE_SELECTED_SEAT] = {
      ...(currentSeatMap[CREATE_SELECTED_SEAT] || {}),
      claimedByUid: CURRENT_UID,
      displayName: creatorName
    };
    renderFieldLabels();
    CURRENT_PLAYER = CREATE_SELECTED_SEAT;
    seatButtons.forEach(b => {
      const s = b.dataset.seat === 'spectator' ? 'spectator' : parseInt(b.dataset.seat, 10);
      b.classList.toggle('active', s === CURRENT_PLAYER);
    });
    startSession(id, CREATE_SELECTED_SEAT);"""
b2_r = """    joinRoomInput.value = id;\n    loadSeatStatus();\n    await setDoc(doc(db, `rooms/${id}`), { hostSeat: null, updatedAt: serverTimestamp() }, { merge: true });\n    CURRENT_PLAYER = 'spectator';\n    startSession(id, 'spectator');"""
text = re.sub(normalize_ws(b2_t), b2_r, text)

# Block 3
b3_t = """  const roomOk = !!(joinRoomInput.value || '').trim();
  const nameNow = (playerNameInput.value || '').trim();
  const nameOk = nameNow.length > 0 && nameNow.length <= 24; const seatOk = !!CURRENT_PLAYER;
  startBtn.disabled = !(roomOk && nameOk && seatOk);"""
b3_r = """  const roomOk = !!(joinRoomInput.value || '').trim();\n  const nameNow = (playerNameInput.value || '').trim();\n  const nameOk = nameNow.length > 0 && nameNow.length <= 24;\n  startBtn.disabled = !(roomOk && nameOk);"""
text = re.sub(normalize_ws(b3_t), b3_r, text)

# Block 4
b4_t = """  const room = (joinRoomInput.value || '').trim();
  const seat = CURRENT_PLAYER;
  const nameNow = (playerNameInput.value || '').trim();
  if (!room) { alert(t('err.roomId')); return; }
  if (!nameNow) { alert(t('err.playerName')); return; }
  if (!seat) { alert(t('err.seat')); return; }"""
b4_r = """  const room = (joinRoomInput.value || '').trim();\n  const seat = 'spectator';\n  const nameNow = (playerNameInput.value || '').trim();\n\n  if (!room) { alert(t('err.roomId')); return; }\n  if (!nameNow) { alert(t('err.playerName')); return; }"""
text = re.sub(normalize_ws(b4_t), b4_r, text)

# Block 5
b5_t = """    const ok = await claimSeat(room, seat);
    if (!ok) { alert('開始直前に座席が埋まりました。別の席を選んでください。'); return; }
    currentSeatMap[seat] = { ...(currentSeatMap[seat] || {}), claimedByUid: CURRENT_UID, displayName: nameNow, color: '#22aaff' };
    renderSeatAvailability();
    // isMe を即時に確定させる（HP UI がこの時点で自席Onlyになる）
    CURRENT_PLAYER = seat;
    seatButtons.forEach(b => {
      const s = b.dataset.seat === 'spectator' ? 'spectator' : parseInt(b.dataset.seat, 10);
      b.classList.toggle('active', s === CURRENT_PLAYER);
    });
    startSession(room, seat);"""
b5_r = """    CURRENT_PLAYER = 'spectator';\n    startSession(room, 'spectator');"""
text = re.sub(normalize_ws(b5_t), b5_r, text)

print("Writing...")
with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(text)
print("Done!")
