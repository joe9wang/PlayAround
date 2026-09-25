import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def generate_shogi_board():
    W, H = 2400, 2400
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1. Background: Gentle Japanese Tatami / Washitsu mat texture
    bg = Image.new('RGBA', (W, H), (218, 222, 198, 255)) # Soft rush-green / tatami tone
    bg_draw = ImageDraw.Draw(bg)
    # Subtle tatami weave lines
    for y in range(0, H, 6):
        alpha = 15 if (y // 6) % 2 == 0 else 8
        bg_draw.line([(0, y), (W, y)], fill=(160, 168, 140, alpha), width=2)
    for x in range(0, W, 20):
        bg_draw.line([(x, 0), (x, H)], fill=(175, 182, 155, 10), width=1)

    img.paste(bg, (0, 0))

    # Helper to create wood grain panel
    def make_wood_panel(pw, ph, base_color=(240, 202, 138), grain_color=(208, 162, 98)):
        panel = Image.new('RGBA', (pw, ph), base_color + (255,))
        pdraw = ImageDraw.Draw(panel)
        random.seed(42)
        for y in range(ph):
            wave = math.sin(y * 0.04) * 8 + math.sin(y * 0.01) * 15
            ratio = (math.sin(y * 0.08 + wave * 0.1) + 1) / 2
            r = int(base_color[0] + (grain_color[0] - base_color[0]) * ratio * 0.4)
            g = int(base_color[1] + (grain_color[1] - base_color[1]) * ratio * 0.4)
            b = int(base_color[2] + (grain_color[2] - base_color[2]) * ratio * 0.4)
            pdraw.line([(0, y), (pw, y)], fill=(r, g, b, 255))
        return panel

    # 2. Center Shogi Board (1720 x 1900)
    bw, bh = 1720, 1900
    bx0, by0 = (W - bw) // 2, (H - bh) // 2
    board_wood = make_wood_panel(bw, bh, base_color=(242, 204, 140), grain_color=(206, 160, 96))

    # Drop shadow for board
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle([bx0 + 10, by0 + 20, bx0 + bw + 15, by0 + bh + 30], radius=16, fill=(0, 0, 0, 85))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    img.paste(shadow, (0, 0), shadow)

    # Paste board wood
    b_mask = Image.new('L', (bw, bh), 0)
    b_mdraw = ImageDraw.Draw(b_mask)
    b_mdraw.rounded_rectangle([0, 0, bw, bh], radius=12, fill=255)
    img.paste(board_wood, (bx0, by0), b_mask)

    draw = ImageDraw.Draw(img)
    # Board beveled border
    draw.rounded_rectangle([bx0, by0, bx0 + bw, by0 + bh], radius=12, outline=(140, 95, 45, 255), width=6)

    # 3. 9x9 Grid (1620 x 1800)
    gx0, gy0 = bx0 + 50, by0 + 50
    cw, ch = 180, 200 # 180 x 9 = 1620, 200 x 9 = 1800
    LINE_COLOR = (38, 28, 18, 255)

    # Outer grid frame
    draw.rectangle([gx0, gy0, gx0 + 9 * cw, gy0 + 9 * ch], outline=LINE_COLOR, width=5)

    # Internal grid lines
    for i in range(1, 9):
        lx = gx0 + i * cw
        draw.line([(lx, gy0), (lx, gy0 + 9 * ch)], fill=LINE_COLOR, width=2)
        ly = gy0 + i * ch
        draw.line([(gx0, ly), (gx0 + 9 * cw, ly)], fill=LINE_COLOR, width=2)

    # Star dots at line 3 and line 6 intersections (3,3), (6,3), (3,6), (6,6)
    dot_r = 7
    for col_idx in [3, 6]:
        for row_idx in [3, 6]:
            dx = gx0 + col_idx * cw
            dy = gy0 + row_idx * ch
            draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=LINE_COLOR)

    # 4. Komadai (駒台)
    # Top-Left: Gote Komadai (270 x 560) at (35, 250)
    # Bottom-Right: Sente Komadai (270 x 560) at (2095, 1590)
    kw, kh = 270, 560
    komadai_coords = [
        (35, 250, '後手 駒台'),
        (2095, 1590, '先手 駒台')
    ]

    for kx, ky, klabel in komadai_coords:
        # Shadow
        k_shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ks_draw = ImageDraw.Draw(k_shadow)
        ks_draw.rounded_rectangle([kx + 6, ky + 10, kx + kw + 10, ky + kh + 16], radius=10, fill=(0, 0, 0, 70))
        k_shadow = k_shadow.filter(ImageFilter.GaussianBlur(10))
        img.paste(k_shadow, (0, 0), k_shadow)

        # Wood panel
        k_wood = make_wood_panel(kw, kh, base_color=(236, 196, 132), grain_color=(198, 150, 90))
        k_mask = Image.new('L', (kw, kh), 0)
        km_draw = ImageDraw.Draw(k_mask)
        km_draw.rounded_rectangle([0, 0, kw, kh], radius=8, fill=255)
        img.paste(k_wood, (kx, ky), k_mask)
        
        # Border
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([kx, ky, kx + kw, ky + kh], radius=8, outline=(130, 85, 40, 255), width=4)

    os.makedirs('image/Shogi', exist_ok=True)
    img.save('image/Shogi/ShogiBoard.png', 'PNG', optimize=True)
    print('ShogiBoard.png created successfully (2400x2400)')

def generate_shogi_thumbnail():
    # 1000x1000 thumbnail showing 9x9 board with all pieces or representative setup
    board = Image.open('image/Shogi/ShogiBoard.png').convert('RGBA')

    # Load pieces
    ou = Image.open('image/Shogi/Oushou.png').convert('RGBA')
    gyoku = Image.open('image/Shogi/Gyokushou.png').convert('RGBA')
    hisha = Image.open('image/Shogi/Hisha.png').convert('RGBA')
    kaku = Image.open('image/Shogi/Kakugyou.png').convert('RGBA')
    kin = Image.open('image/Shogi/Kinshou.png').convert('RGBA')
    gin = Image.open('image/Shogi/Ginshou.png').convert('RGBA')
    kei = Image.open('image/Shogi/Keima.png').convert('RGBA')
    kyou = Image.open('image/Shogi/Kyousha.png').convert('RGBA')
    fu = Image.open('image/Shogi/Fuhyou.png').convert('RGBA')

    # Dimensions
    # gx0 = (2400 - 1720) // 2 + 50 = 390
    # gy0 = (2400 - 1900) // 2 + 50 = 300
    gx0, gy0 = 390, 300
    cw, ch = 180, 200
    pw, ph = 145, 155
    ox = (cw - pw) // 2
    oy = (ch - ph) // 2

    def place_p(col, row, p_img, rot=0):
        resized = p_img.resize((pw, ph), Image.Resampling.LANCZOS)
        if rot == 180:
            resized = resized.rotate(180)
        px = gx0 + col * cw + ox
        py = gy0 + row * ch + oy
        board.paste(resized, (px, py), resized)

    # Gote (top, rot=180)
    # Row 0: 香 桂 銀 金 王 金 銀 桂 香
    row0 = [kyou, kei, gin, kin, ou, kin, gin, kei, kyou]
    for c, p in enumerate(row0):
        place_p(c, 0, p, rot=180)
    # Row 1: 飛(col 1), 角(col 7)
    place_p(1, 1, hisha, rot=180)
    place_p(7, 1, kaku, rot=180)
    # Row 2: 9x 歩
    for c in range(9):
        place_p(c, 2, fu, rot=180)

    # Sente (bottom, rot=0)
    # Row 6: 9x 歩
    for c in range(9):
        place_p(c, 6, fu, rot=0)
    # Row 7: 角(col 1), 飛(col 7)
    place_p(1, 7, kaku, rot=0)
    place_p(7, 7, hisha, rot=0)
    # Row 8: 香 桂 銀 金 玉 金 銀 桂 香
    row8 = [kyou, kei, gin, kin, gyoku, kin, gin, kei, kyou]
    for c, p in enumerate(row8):
        place_p(c, 8, p, rot=0)

    # Resize to 1000x1000 square thumbnail
    thumb = board.resize((1000, 1000), Image.Resampling.LANCZOS)
    thumb.save('image/Shogi_Field.png', 'PNG', optimize=True)
    print('Shogi_Field.png created successfully (1000x1000)')

if __name__ == '__main__':
    generate_shogi_board()
    generate_shogi_thumbnail()
