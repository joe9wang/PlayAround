import sys
path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Elements bindAreaContextMenuOnce
o1 = """  const btnEnlarge = document.getElementById('area-ctx-enlarge');
  const btnShrink = document.getElementById('area-ctx-shrink');
  const btnMove = document.getElementById('area-ctx-move');"""

n1 = """  const btnEnlarge = document.getElementById('area-ctx-enlarge');
  const btnShrink = document.getElementById('area-ctx-shrink');
  const btnEnlargeW = document.getElementById('area-ctx-enlarge-w');
  const btnShrinkW = document.getElementById('area-ctx-shrink-w');
  const btnEnlargeH = document.getElementById('area-ctx-enlarge-h');
  const btnShrinkH = document.getElementById('area-ctx-shrink-h');
  const btnMove = document.getElementById('area-ctx-move');"""

# 2. Add event listeners
o2 = """  if (btnShrink) {
    btnShrink.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const currentLevel = snap.exists() && typeof snap.data().scaleLevel === 'number' ? snap.data().scaleLevel : 0;
        await setDoc(docRef, { scaleLevel: currentLevel - 1, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }"""

n2 = """  if (btnShrink) {
    btnShrink.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const currentLevel = snap.exists() && typeof snap.data().scaleLevel === 'number' ? snap.data().scaleLevel : 0;
        await setDoc(docRef, { scaleLevel: currentLevel - 1, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }

  if (btnEnlargeW) {
    btnEnlargeW.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const cur = snap.exists() && typeof snap.data().multX === 'number' ? snap.data().multX : 1;
        await setDoc(docRef, { multX: cur * 2, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }

  if (btnShrinkW) {
    btnShrinkW.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const cur = snap.exists() && typeof snap.data().multX === 'number' ? snap.data().multX : 1;
        await setDoc(docRef, { multX: cur * 0.5, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }

  if (btnEnlargeH) {
    btnEnlargeH.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const cur = snap.exists() && typeof snap.data().multY === 'number' ? snap.data().multY : 1;
        await setDoc(docRef, { multY: cur * 2, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }

  if (btnShrinkH) {
    btnShrinkH.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;
      try {
        const docRef = doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`);
        const snap = await getDoc(docRef);
        const cur = snap.exists() && typeof snap.data().multY === 'number' ? snap.data().multY : 1;
        await setDoc(docRef, { multY: cur * 0.5, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { console.warn(err); }
    });
  }"""

# 3. subscribeAreas logic
o3 = """      }
      
      const scaleLevel = data.scaleLevel || 0;
      const scale = Math.pow(1.2, scaleLevel);
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = '50% 50%';
    });
  });"""

n3 = """      }
      
      const scaleLevel = data.scaleLevel || 0;
      const multX = data.multX || 1;
      const multY = data.multY || 1;
      const scale = Math.pow(1.2, scaleLevel);
      el.style.transform = `scale(${scale * multX}, ${scale * multY})`;
      el.style.transformOrigin = '50% 50%';
    });
  });"""

def do_rep(t, o, n):
    if o in t: return t.replace(o, n)
    if o.replace('\\n', '\\r\\n') in t: return t.replace(o.replace('\\n', '\\r\\n'), n.replace('\\n', '\\r\\n'))
    print("Not found:\\n", o[:100])
    return t

t1 = do_rep(text, o1, n1)
t2 = do_rep(t1, o2, n2)
t3 = do_rep(t2, o3, n3)

if t3 == text:
    print("No changes made.")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t3)

print("Success")
