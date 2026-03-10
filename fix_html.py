import os
import glob
import re

html_files = glob.glob('*.html') + glob.glob('partials/*.html')
for filepath in html_files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = content.replace('?v=2" rel="icon"', '?v=3" rel="icon"')
        new_content = new_content.replace('?v=2" rel="apple-touch-icon"', '?v=3" rel="apple-touch-icon"')
        new_content = re.sub(r'"/BatriTable-icon\.png(\?v=\d+)?"', '"/BatriTable-icon.png?v=3"', new_content)

        if new_content != content:
            with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
                f.write(new_content)
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
