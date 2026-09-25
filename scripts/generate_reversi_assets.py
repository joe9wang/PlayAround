import math
from PIL import Image, ImageDraw, ImageFilter

def create_board():
    # 3600 x 2000 px
    # Left tray: 760 x 1920 at (40, 40)
    # Center board: 1920 x 1920 at (840, 40)
    # Right tray: 760 x 1920 at (2800, 40)
    # Total width: 40 + 760 + 40 + 1920 + 40 + 760 + 40 = 3600 px
    # Total height: 40 + 1920 + 40 = 2000 px
    
    W, H = 3600, 2000
    # Background: clean transparent
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    GREEN_TOP = (20, 130, 65, 255)
    GREEN_BOT = (14, 105, 50, 255)
    BORDER_COLOR = (24, 24, 27, 255) # Sleek dark charcoal/black
    GRID_COLOR = (24, 24, 27, 255)
    DOT_COLOR = (24, 24, 27, 255)

    def draw_rounded_rect_with_grad(box, radius, border_w):
        x0, y0, x1, y1 = box
        w = x1 - x0
        h = y1 - y0
        # Draw gradient fill
        panel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        p_draw = ImageDraw.Draw(panel)
        for y in range(h):
            r_ratio = y / h
            r = int(GREEN_TOP[0] + (GREEN_BOT[0] - GREEN_TOP[0]) * r_ratio)
            g = int(GREEN_TOP[1] + (GREEN_BOT[1] - GREEN_TOP[1]) * r_ratio)
            b = int(GREEN_TOP[2] + (GREEN_BOT[2] - GREEN_TOP[2]) * r_ratio)
            p_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
        
        # Mask with rounded rect
        mask = Image.new("L", (w, h), 0)
        m_draw = ImageDraw.Draw(mask)
        m_draw.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
        
        # Composite panel
        img.paste(panel, (x0, y0), mask)
        
        # Draw border
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=BORDER_COLOR, width=border_w)

    # 1. Left Tray
    draw_rounded_rect_with_grad((40, 40, 800, 1960), radius=16, border_w=14)

    # 2. Right Tray
    draw_rounded_rect_with_grad((2800, 40, 3560, 1960), radius=16, border_w=14)

    # 3. Center Board
    cx0, cy0, cx1, cy1 = 840, 40, 2760, 1960
    draw_rounded_rect_with_grad((cx0, cy0, cx1, cy1), radius=16, border_w=16)

    # Grid for Center Board: 8x8 squares, each 240x240 px
    for i in range(1, 8):
        x = cx0 + i * 240
        draw.line([(x, cy0 + 8), (x, cy1 - 8)], fill=GRID_COLOR, width=5)
        y = cy0 + i * 240
        draw.line([(cx0 + 8, y), (cx1 - 8, y)], fill=GRID_COLOR, width=5)

    # 4 Star dots at intersections: (2,2), (2,6), (6,2), (6,6)
    dot_radius = 12
    for r_idx in [2, 6]:
        for c_idx in [2, 6]:
            dx = cx0 + c_idx * 240
            dy = cy0 + r_idx * 240
            draw.ellipse([dx - dot_radius, dy - dot_radius, dx + dot_radius, dy + dot_radius], fill=DOT_COLOR)

    img.save("image/Reversi/ReversiBoard.png", "PNG", optimize=True)
    print("ReversiBoard.png created successfully (3600x2000)")

def create_piece(color="black"):
    size = 256
    # Supersampling 2x for smooth antialiasing
    scale = 2
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 14 * scale
    r = (S - margin * 2) / 2
    cx, cy = S / 2, S / 2

    # Shadow underneath
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.ellipse([cx - r + 2*scale, cy - r + 8*scale, cx + r + 2*scale, cy + r + 8*scale], fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8 * scale))
    img.paste(shadow, (0, 0), shadow)

    # Main disk
    if color == "black":
        # Radial gradient for 3D curved black stone
        base_color = (28, 28, 30)
        edge_color = (12, 12, 14)
        highlight = (80, 80, 88)
        
        # Draw outer rim
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=edge_color)
        
        # Radial gradient body
        for step in range(int(r), 0, -1):
            ratio = step / r
            # Light source at top-left (cx - r*0.25, cy - r*0.25)
            lx = cx - (1 - ratio) * (r * 0.22)
            ly = cy - (1 - ratio) * (r * 0.25)
            
            # Interpolate
            val = int(edge_color[0] + (base_color[0] - edge_color[0]) * (1 - ratio * 0.6))
            draw.ellipse([lx - step, ly - step, lx + step, ly + step], fill=(val, val, val, 255))
            
        # Subtle specular highlight on top-left
        hl_r = r * 0.45
        hl_cx = cx - r * 0.22
        hl_cy = cy - r * 0.25
        hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        hl_draw = ImageDraw.Draw(hl)
        hl_draw.ellipse([hl_cx - hl_r, hl_cy - hl_r * 0.7, hl_cx + hl_r, hl_cy + hl_r * 0.7], fill=(255, 255, 255, 38))
        hl = hl.filter(ImageFilter.GaussianBlur(12 * scale))
        img = Image.alpha_composite(img, hl)

        # Subtle white rim to distinguish on black background / ensure crisp contrast as in user image
        draw = ImageDraw.Draw(img)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(220, 220, 225, 200), width=3 * scale)

    else:
        # White piece
        base_color = (252, 252, 254)
        edge_color = (205, 210, 218)
        
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=edge_color)
        
        for step in range(int(r), 0, -1):
            ratio = step / r
            lx = cx - (1 - ratio) * (r * 0.22)
            ly = cy - (1 - ratio) * (r * 0.25)
            
            val = int(edge_color[0] + (base_color[0] - edge_color[0]) * (1 - ratio * 0.7))
            draw.ellipse([lx - step, ly - step, lx + step, ly + step], fill=(val, val, val, 255))
            
        # Crisp darker outer edge
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(70, 75, 85, 220), width=3 * scale)

    # Downsample
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    filename = f"image/Reversi/Reversi_{color.capitalize()}.png"
    img.save(filename, "PNG", optimize=True)
    print(f"{filename} created successfully (256x256)")

def create_lobby_thumbnail():
    # Load piece images
    b_piece = Image.open('image/Reversi/Reversi_Black.png').convert('RGBA')
    w_piece = Image.open('image/Reversi/Reversi_White.png').convert('RGBA')

    # Create 1000x1000 square board thumbnail
    S = 1000
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = 24
    bw = S - pad * 2
    bh = S - pad * 2

    GREEN_TOP = (20, 130, 65, 255)
    GREEN_BOT = (14, 105, 50, 255)
    BORDER_COLOR = (24, 24, 27, 255)
    GRID_COLOR = (24, 24, 27, 255)
    DOT_COLOR = (24, 24, 27, 255)

    # Gradient fill for board
    panel = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(panel)
    for y in range(bh):
        r_ratio = y / bh
        r = int(GREEN_TOP[0] + (GREEN_BOT[0] - GREEN_TOP[0]) * r_ratio)
        g = int(GREEN_TOP[1] + (GREEN_BOT[1] - GREEN_TOP[1]) * r_ratio)
        b = int(GREEN_TOP[2] + (GREEN_BOT[2] - GREEN_TOP[2]) * r_ratio)
        p_draw.line([(0, y), (bw, y)], fill=(r, g, b, 255))

    mask = Image.new('L', (bw, bh), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, bw, bh], radius=16, fill=255)
    img.paste(panel, (pad, pad), mask)
    draw.rounded_rectangle([pad, pad, pad + bw, pad + bh], radius=16, outline=BORDER_COLOR, width=8)

    # 8x8 grid
    sq = bw / 8.0
    for i in range(1, 8):
        x = pad + i * sq
        draw.line([(x, pad + 4), (x, pad + bh - 4)], fill=GRID_COLOR, width=3)
        y = pad + i * sq
        draw.line([(pad + 4, y), (pad + bw - 4, y)], fill=GRID_COLOR, width=3)

    # 4 star dots at (2,2), (2,6), (6,2), (6,6)
    dot_r = 6
    for r_idx in [2, 6]:
        for c_idx in [2, 6]:
            dx = pad + c_idx * sq
            dy = pad + r_idx * sq
            draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=DOT_COLOR)

    # Center 4 pieces
    p_size = int(sq * 0.8)
    b_piece_resized = b_piece.resize((p_size, p_size), Image.Resampling.LANCZOS)
    w_piece_resized = w_piece.resize((p_size, p_size), Image.Resampling.LANCZOS)

    offset = (sq - p_size) / 2.0
    def place(col, row, p_img):
        px = int(pad + col * sq + offset)
        py = int(pad + row * sq + offset)
        img.paste(p_img, (px, py), p_img)

    place(3, 3, w_piece_resized)
    place(4, 3, b_piece_resized)
    place(3, 4, b_piece_resized)
    place(4, 4, w_piece_resized)

    img.save('image/Reversi_Field.png', 'PNG', optimize=True)
    print('Reversi_Field.png created successfully (1000x1000)')

if __name__ == "__main__":
    create_board()
    create_piece("black")
    create_piece("white")
    create_lobby_thumbnail()
