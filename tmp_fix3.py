import sys

path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix 1: subscribeAreas change.type === 'removed'
o1 = """      if (change.type === 'removed') {
        if (!parts) {
          console.warn('[subscribeAreas] removed → el.remove() id=', id);
          el.remove();
        } else {
          el.style.backgroundImage = '';
          el.style.backgroundSize = '';
          el.style.backgroundPosition = '';
          el.style.backgroundRepeat = '';
        }
        return;
      }"""

n1 = """      if (change.type === 'removed') {
        if (el.classList.contains('dynamic-area')) {
          console.warn('[subscribeAreas] removed → el.remove() id=', id);
          el.remove();
        } else {
          el.style.backgroundImage = '';
          el.style.backgroundSize = '';
          el.style.backgroundPosition = '';
          el.style.backgroundRepeat = '';
        }
        return;
      }"""

# Fix 2: Global area deletion
o2 = """      try {
        await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`));
        const el = getCurrentTargetAreaElement();
        if (el) {
          if (el.classList.contains('dynamic-area') || el.classList.contains('center-deck') || el.classList.contains('center-discard')) {
            el.remove();
          } else {
            el.style.display = 'none';
          }
        }
      } catch (err) {
        console.warn('Failed to delete area entirely:', err);
      }"""

n2 = """      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        await setDoc(docRef, { isDeleted: true }, { merge: true });
        
        // ローカルでも直ちに反映
        const el = getCurrentTargetAreaElement();
        if (el) {
          if (el.classList.contains('dynamic-area') || el.classList.contains('center-deck') || el.classList.contains('center-discard')) {
            el.remove();
          } else {
            el.style.display = 'none';
          }
        }
      } catch (err) {
        console.warn('Failed to delete area entirely:', err);
      }"""

# Fix 3: Handle isDeleted inside subscribeAreas
o3 = """      // Background image sync
      if (!data.imageUrl) {
        el.style.backgroundImage = '';"""

n3 = """      // Deleted flag sync from other players
      if (data.isDeleted) {
        if (el.classList.contains('dynamic-area') || el.classList.contains('center-deck') || el.classList.contains('center-discard')) {
          el.remove();
        } else {
          el.style.display = 'none';
        }
        return;
      } else {
        el.style.display = ''; // Restore if undeleted
      }

      // Background image sync
      if (!data.imageUrl) {
        el.style.backgroundImage = '';"""

def do_rep(t, o, n):
    if o in t: return t.replace(o, n)
    elif o.replace('\\n', '\\r\\n') in t: return t.replace(o.replace('\\n', '\\r\\n'), n.replace('\\n', '\\r\\n'))
    print("Not found:\\n", o[:100])
    return t

t1 = do_rep(text, o1, n1)
t2 = do_rep(t1, o2, n2)
t3 = do_rep(t2, o3, n3)

if t3 == text:
    print("Nothing changed")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t3)

print("Success")
