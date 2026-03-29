import sys

path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old_str1 = """    const roomRef = doc(db, `rooms/${id}`);
    const existsSnap = await getDoc(roomRef);
    if (existsSnap.exists() && existsSnap.data()?.hostUid && existsSnap.data().hostUid !== uid) {
      // 座席8つ（旧互換含む）を並列取得して“生存者がいるか”を判定"""

new_str1 = """    const roomRef = doc(db, `rooms/${id}`);
    const existsSnap = await getDoc(roomRef);
    const roomData = existsSnap.exists() ? existsSnap.data() : null;

    if (roomData && (roomData.hostUid !== uid || roomData.roomClosed === true)) {
      if (roomData.hostUid !== uid) {
        // 座席8つ（旧互換含む）を並列取得して“生存者がいるか”を判定"""

old_str2 = """      if (someoneAlive) {
        alert('このルームIDは他のホストが使用中です。別のIDにしてください。');
        return;
      }
      // ▼ 誰も座っていない → サーバAPIで「乗っ取り」を実行（管理者権限で初期化）"""

new_str2 = """      if (someoneAlive) {
          alert('このルームIDは他のホストが使用中です。別のIDにしてください。');
          return;
        }
      }
      // ▼ サーバAPIで「初期化処理」を実行（管理者権限で初期化）"""

def do_replace(txt, o, n):
    if o in txt:
        return txt.replace(o, n)
    elif o.replace("\n", "\r\n") in txt:
        return txt.replace(o.replace("\n", "\r\n"), n.replace("\n", "\r\n"))
    else:
        print("Not found:\n", o[:100])
        return txt

t1 = do_replace(text, old_str1, new_str1)
t2 = do_replace(t1, old_str2, new_str2)

if t1 == text or t2 == t1:
    print("Failed to replace!")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t2)
print("Success!")
