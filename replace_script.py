import io

path = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js"
with io.open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target1 = "  if (!id) { alert(t('err.roomId')); return; }\n  if (!creatorName) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }\n  if (!CREATE_SELECTED_SEAT) { alert(t('err.seat')); return; }\n  if (CREATE_SELECTED_SEAT === 'spectator') { alert('観戦モードで新しいルームを作成することはできません。'); return; }"
replace1 = "  if (!id) { alert(t('err.roomId')); return; }\n  if (!creatorName) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }"
text = text.replace(target1, replace1)

target2 = """    joinRoomInput.value = id;
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
replace2 = """    joinRoomInput.value = id;
    loadSeatStatus();

    await setDoc(doc(db, `rooms/${id}`), { hostSeat: null, updatedAt: serverTimestamp() }, { merge: true });

    CURRENT_PLAYER = 'spectator';
    startSession(id, 'spectator');"""
text = text.replace(target2, replace2)

target3 = """  const roomOk = !!(joinRoomInput.value || '').trim();
  const nameNow = (playerNameInput.value || '').trim();
  const nameOk = nameNow.length > 0 && nameNow.length <= 24; const seatOk = !!CURRENT_PLAYER;
  startBtn.disabled = !(roomOk && nameOk && seatOk);
}"""
replace3 = """  const roomOk = !!(joinRoomInput.value || '').trim();
  const nameNow = (playerNameInput.value || '').trim();
  const nameOk = nameNow.length > 0 && nameNow.length <= 24;
  startBtn.disabled = !(roomOk && nameOk);
}"""
text = text.replace(target3, replace3)

target4 = """  const room = (joinRoomInput.value || '').trim();
  const seat = CURRENT_PLAYER;
  const nameNow = (playerNameInput.value || '').trim();

  if (!room) { alert(t('err.roomId')); return; }
  if (!nameNow) { alert(t('err.playerName')); return; }
  if (!seat) { alert(t('err.seat')); return; }"""
replace4 = """  const room = (joinRoomInput.value || '').trim();
  const seat = 'spectator';
  const nameNow = (playerNameInput.value || '').trim();

  if (!room) { alert(t('err.roomId')); return; }
  if (!nameNow) { alert(t('err.playerName')); return; }"""
text = text.replace(target4, replace4)

target5 = """    const ok = await claimSeat(room, seat);
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
replace5 = """    CURRENT_PLAYER = 'spectator';
    startSession(room, 'spectator');"""
text = text.replace(target5, replace5)

with io.open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print("Finished!")
