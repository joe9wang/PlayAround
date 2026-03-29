import io
import re

path = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js"

with io.open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Fix updateSessionIndicator
target1 = """  if (CURRENT_PLAYER !== 'spectator') {
    const seatData = currentSeatMap[CURRENT_PLAYER];
    if (seatData && seatData.displayName) pName = seatData.displayName;
    seatDisplay = P;
  }
  sessionIndicator.textContent = ROOM:  / PLAYER:  / SEAT: ;"""

replace1 = """  if (CURRENT_PLAYER !== 'spectator') {
    const seatData = currentSeatMap[CURRENT_PLAYER];
    if (seatData && seatData.displayName) pName = seatData.displayName;
    seatDisplay = `P${CURRENT_PLAYER}`;
  }
  sessionIndicator.textContent = `ROOM: ${CURRENT_ROOM} / PLAYER: ${pName} / SEAT: ${seatDisplay}`;"""

text = text.replace(target1, replace1)

# Fix seat selection syntax error 1
target2 = """      if (isUsed) {
        btn.classList.add('active');
        btn.disabled = true;
        btn.textContent = P(満席);
        btn.style.opacity = '0.5';
      } else {
        btn.textContent = P;
      }"""

replace2 = """      if (isUsed) {
        btn.classList.add('active');
        btn.disabled = true;
        btn.textContent = `P${i} (満席)`;
        btn.style.opacity = '0.5';
      } else {
        btn.textContent = `P${i}`;
      }"""

text = text.replace(target2, replace2)

# Fix seat selection syntax error 2
target3 = """        if (!ok) { alert(Pはいま埋まりました。別の座席を選んでください。); return; }"""
replace3 = """        if (!ok) { alert(`P${i} はすでに埋まりました。別の座席を選んでください。`); return; }"""
text = text.replace(target3, replace3)

print("Writing...")
with io.open(path, "w", encoding="utf-8", newline="") as f:
    f.write(text)
print("Done!")
