import os
from PIL import Image

source_path = r"C:\Users\joe9w\.gemini\antigravity\brain\15a73b7a-10b6-4f7d-bf31-c0790e114606\media__1773113676427.png"
target_dir = r"c:\Users\joe9w\OneDrive\ドキュメント\GitHub\card-game"

sizes = {
    'favicon-16.png': (16, 16),
    'favicon-32.png': (32, 32),
    'favicon-192.png': (192, 192),
    'favicon-512.png': (512, 512),
    'apple-touch-icon.png': (180, 180),
    'BatriTable-icon.png': (256, 256)
}

try:
    with Image.open(source_path) as img:
        for filename, size in sizes.items():
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
            output_path = os.path.join(target_dir, filename)
            resized_img.save(output_path, "PNG")
        
        ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
        ico_path = os.path.join(target_dir, 'favicon.ico')
        img.save(ico_path, format="ICO", sizes=ico_sizes)
except Exception as e:
    print(f"Error: {e}")
