import sys
import re

path = r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add btnDeleteArea definition
o1 = """  const ctxMenu = document.getElementById('area-context-menu');
  const btnChangeBg = document.getElementById('area-ctx-change-bg');
  const btnRemoveBg = document.getElementById('area-ctx-remove-bg');
  const fileInput = document.getElementById('area-bg-file');"""

n1 = """  const ctxMenu = document.getElementById('area-context-menu');
  const btnChangeBg = document.getElementById('area-ctx-change-bg');
  const btnRemoveBg = document.getElementById('area-ctx-remove-bg');
  const btnDeleteArea = document.getElementById('area-ctx-delete-area');
  const fileInput = document.getElementById('area-bg-file');"""

# 2. Add visibility logic
o2 = """    // Hide 'Move' or 'Add' depending on area
    if (isHost && btnMove && btnAddArea) {
      if (aClass === 'play-area' || aClass === 'main-play-area') {
        btnMove.style.display = 'none';
        btnAddArea.style.display = 'flex';
      } else {
        btnMove.style.display = 'flex';
        btnAddArea.style.display = 'none';
      }
    }"""

n2 = """    // Hide 'Move' or 'Add' depending on area
    if (isHost && btnMove && btnAddArea) {
      if (aClass === 'play-area' || aClass === 'main-play-area') {
        btnMove.style.display = 'none';
        btnAddArea.style.display = 'flex';
      } else {
        btnMove.style.display = 'flex';
        btnAddArea.style.display = 'none';
      }
    }

    if (isHost && btnDeleteArea) {
      const isPlayOrHand = ['play-area', 'main-play-area', 'hand-area', 'board-play', 'board-hand'].includes(aClass) || 
                           ['board-play', 'board-hand'].includes(currentTargetAreaId) || 
                           area.classList.contains('board-hand') || area.classList.contains('hand-area');
      if (isPlayOrHand) {
        btnDeleteArea.style.display = 'none';
      } else {
        btnDeleteArea.style.display = 'flex';
      }
    }"""

# 3. Add event listener logic around line 5816
o3 = """  // メニュー: 画像削除をクリック
  btnRemoveBg.addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    if (!CURRENT_ROOM || !currentTargetAreaId) return;

    try {
      await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`));
    } catch (err) {
      console.warn('Failed to delete area bg:', err);
    }
  });"""

n3 = """  // メニュー: 画像削除をクリック
  btnRemoveBg.addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    if (!CURRENT_ROOM || !currentTargetAreaId) return;

    try {
      await deleteDoc(doc(db, `rooms/${CURRENT_ROOM}/areas/${currentTargetAreaId}`));
    } catch (err) {
      console.warn('Failed to delete area bg:', err);
    }
  });

  if (btnDeleteArea) {
    btnDeleteArea.addEventListener('click', async (e) => {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      if (!CURRENT_ROOM || !currentTargetAreaId) return;

      if (!confirm('このエリアを完全に削除（非表示）にしますか？\\n※ページをリロードすると元に戻る場合があります')) return;

      try {
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
      }
    });
  }"""

def replace_str(t, old, new):
    if old in t:
        return t.replace(old, new)
    elif old.replace('\\n', '\\r\\n') in t:
        return t.replace(old.replace('\\n', '\\r\\n'), new.replace('\\n', '\\r\\n'))
    else:
        print("Not found:", old[:100])
        return t

t1 = replace_str(text, o1, n1)
t2 = replace_str(t1, o2, n2)
t3 = replace_str(t2, o3, n3)

if t3 == text:
    print("Nothing changed!")
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t3)

print("Success!")
