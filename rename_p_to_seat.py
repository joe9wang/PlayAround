import io
import re
import os

def process_file(path):
    if not os.path.exists(path):
        print(f"Skipping {path} (not found)")
        return
    with io.open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Replace template prefixes where they refer to seats
    text = text.replace('`P${', '`SEAT${')
    text = text.replace('"P${', '"SEAT${')
    text = text.replace("'P${", "'SEAT${")

    # Replace current indicator formats
    text = text.replace(' / SEAT: P', ' / SEAT: SEAT')
    text = text.replace('SEAT: P', 'SEAT: SEAT')
    
    # Replace common P followed by digit patterns if they are seat identifiers
    # We look for P1-P8 that are NOT part of a longer word.
    # We allow some trailing punctuation or space.
    text = re.sub(r'(?<![a-zA-Z])P([1-8])(?![a-zA-Z0-9])', r'SEAT\1', text)

    # Specific common strings in my session logic from previous turns
    # If the script above replaced P in SEAT: P to SEAT: SEAT, it's fine.
    # Ensure SEATprefix isn't doubled
    text = text.replace('SEATSEAT', 'SEAT')
    
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)

# Files to update
files = [
    r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\game.module.js',
    r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\game.html',
    r'c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game\scripts\hp.js'
]

for f in files:
    process_file(f)

print("Renaming completed successfully.")
