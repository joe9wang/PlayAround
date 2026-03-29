import re
import io

path = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js"
with io.open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Chunk 1
c1_target = r"if \(!id\) \{ alert\(t\('err\.roomId'\)\); return; \}\s*if \(!creatorName\) \{ alert\(t\('err\.playerName'\)\); newPlayerNameInput\.focus\(\); return; \}\s*if \(!CREATE_SELECTED_SEAT\) \{ alert\(t\('err\.seat'\)\); return; \}\s*if \(CREATE_SELECTED_SEAT === 'spectator'\) \{ alert\('観戦モードで新しいルームを作成することはできません。'\); return; \}"
c1_replace = r"if (!id) { alert(t('err.roomId')); return; }\n  if (!creatorName) { alert(t('err.playerName')); newPlayerNameInput.focus(); return; }"
text = re.sub(c1_target, c1_replace, text)

# Chunk 2
c2_target = r"joinRoomInput\.value = id;\s*loadSeatStatus\(\);\s*const ok = await claimSeat\(id, CREATE_SELECTED_SEAT\);\s*if \(!ok\) \{ alert\(`P\$\{CREATE_SELECTED_SEAT\} は使用中でした。別の座席を選んでください。`\); return; \}\s*await setDoc\(doc\(db, `rooms/\$\{id\}`\), \{ hostSeat: CREATE_SELECTED_SEAT, updatedAt: serverTimestamp\(\) \}, \{ merge: true \}\);\s*currentSeatMap\[CREATE_SELECTED_SEAT\] = \{\s*\.\.\.\(currentSeatMap\[CREATE_SELECTED_SEAT\] \|\| \{\}\),\s*claimedByUid: CURRENT_UID,\s*displayName: creatorName\s*\};\s*renderFieldLabels\(\);\s*CURRENT_PLAYER = CREATE_SELECTED_SEAT;\s*seatButtons\.forEach\(b => \{\s*const s = b\.dataset\.seat === 'spectator' \? 'spectator' : parseInt\(b\.dataset\.seat, 10\);\s*b\.classList\.toggle\('active', s === CURRENT_PLAYER\);\s*\}\);\s*startSession\(id, CREATE_SELECTED_SEAT\);"
c2_replace = """joinRoomInput.value = id;
    loadSeatStatus();
    await setDoc(doc(db, `rooms/${id}`), { hostSeat: null, updatedAt: serverTimestamp() }, { merge: true });
    CURRENT_PLAYER = 'spectator';
    startSession(id, 'spectator');"""
text = re.sub(c2_target, c2_replace, text)

# Chunk 3
c3_target = r"const roomOk = !!\(joinRoomInput\.value \|\| ''\)\.trim\(\);\s*const nameNow = \(playerNameInput\.value \|\| ''\)\.trim\(\);\s*const nameOk = nameNow\.length > 0 && nameNow\.length <= 24; const seatOk = !!CURRENT_PLAYER;\s*startBtn\.disabled = !\(roomOk && nameOk && seatOk\);"
c3_replace = """const roomOk = !!(joinRoomInput.value || '').trim();
  const nameNow = (playerNameInput.value || '').trim();
  const nameOk = nameNow.length > 0 && nameNow.length <= 24;
  startBtn.disabled = !(roomOk && nameOk);"""
text = re.sub(c3_target, c3_replace, text)

# Chunk 4
c4_target = r"const room = \(joinRoomInput\.value \|\| ''\)\.trim\(\);\s*const seat = CURRENT_PLAYER;\s*const nameNow = \(playerNameInput\.value \|\| ''\)\.trim\(\);\s*if \(!room\) \{ alert\(t\('err\.roomId'\)\); return; \}\s*if \(!nameNow\) \{ alert\(t\('err\.playerName'\)\); return; \}\s*if \(!seat\) \{ alert\(t\('err\.seat'\)\); return; \}"
c4_replace = """const room = (joinRoomInput.value || '').trim();
  const seat = 'spectator';
  const nameNow = (playerNameInput.value || '').trim();

  if (!room) { alert(t('err.roomId')); return; }
  if (!nameNow) { alert(t('err.playerName')); return; }"""
text = re.sub(c4_target, c4_replace, text)

# Chunk 5
c5_target = r"const ok = await claimSeat\(room, seat\);\s*if \(!ok\) \{ alert\('開始直前に座席が埋まりました。別の席を選んでください。'\); return; \}\s*currentSeatMap\[seat\] = \{ \.\.\.\(currentSeatMap\[seat\] \|\| \{\}\), claimedByUid: CURRENT_UID, displayName: nameNow, color: '#22aaff' \};\s*renderSeatAvailability\(\);\s*// isMe を即時に確定させる（HP UI がこの時点で自席Onlyになる）\s*CURRENT_PLAYER = seat;\s*seatButtons\.forEach\(b => \{\s*const s = b\.dataset\.seat === 'spectator' \? 'spectator' : parseInt\(b\.dataset\.seat, 10\);\s*b\.classList\.toggle\('active', s === CURRENT_PLAYER\);\s*\}\);\s*startSession\(room, seat\);"
c5_replace = """CURRENT_PLAYER = 'spectator';
    startSession(room, 'spectator');"""
text = re.sub(c5_target, c5_replace, text)

with io.open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("done")
