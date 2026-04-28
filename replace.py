import re

with open('mypage.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'<strong>スロット(\d+)</strong>(<span class="count" id="slot\d+-count">\(\d+枚\)</span>\s*</div>\s*)<div class="muted" id="slot\d+-updated">最終更新: -</div>'
replacement = r'<strong>マイセット\1</strong>\2<div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;"><span style="font-size: 13px; color: #777;">セット名:</span><input type="text" id="slot\1-name" class="slot-name-edit" data-slot="\1" value="" style="border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px; width: 140px; font-size: 14px;" placeholder="未設定"></div>\n            <div class="muted" id="slot\1-updated" style="margin-top: 4px;">最終更新: -</div>'

new_content = re.sub(pattern, replacement, content)

with open('mypage.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
