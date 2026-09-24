import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import collections

os.makedirs('assets/mobs/sprites/256', exist_ok=True)
os.makedirs('assets/mobs/sprites/512', exist_ok=True)
os.makedirs('assets/mobs/portraits/256', exist_ok=True)
os.makedirs('assets/mobs/portraits/512', exist_ok=True)

SKIN_FILES = {
    1: 'skins/Chicken.jpg',
    2: 'skins/pig.jpg',
    3: 'skins/cow.jpg',
    4: 'skins/sheep.jpg',
    5: 'skins/rabbit.jpg',
    6: 'skins/bat.jpg',
    7: 'skins/Zombie.jpg',
    8: 'skins/Skeleton.jpg',
    9: 'skins/Spider.jpg',
    10: 'skins/crepper.jpg',
}

def draw_star(draw, cx, cy, r_outer, r_inner, fill, outline=None, width=1):
    import math
    points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=fill, outline=outline, width=width)

def extract_alpha_sprite(src_path, size=512, mob_id=1):
    im = Image.open(src_path).convert('RGB')
    im_resized = im.resize((size, size), Image.Resampling.LANCZOS)
    arr = np.array(im_resized, dtype=np.float32)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    max_diff = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    if mob_id in (8, 10):
        # Skeleton (#8) and Creeper (#10) have darker studio lighting near top edge (RGB 236-242),
        # but with neutral studio gray/white cyclorama (max_diff <= 4).
        is_bg_candidate = (r > 235) & (g > 235) & (b > 235) & (max_diff <= 4)
    else:
        is_bg_candidate = (r > 242) & (g > 242) & (b > 242)
    
    h, w = is_bg_candidate.shape
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    
    queue = collections.deque()
    for x in range(w):
        if is_bg_candidate[0, x]: queue.append((0, x)); visited[0, x] = True
        if is_bg_candidate[h-1, x]: queue.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if is_bg_candidate[y, 0]: queue.append((y, 0)); visited[y, 0] = True
        if is_bg_candidate[y, w-1]: queue.append((y, w-1)); visited[y, w-1] = True
        
    while queue:
        cy, cx = queue.popleft()
        bg_mask[cy, cx] = True
        for ny, nx in ((cy+1, cx), (cy-1, cx), (cy, cx+1), (cy, cx-1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                if is_bg_candidate[ny, nx]:
                    queue.append((ny, nx))
                    
    fg_mask = (~bg_mask).astype(np.uint8) * 255
    mask_im = Image.fromarray(fg_mask, mode='L')
    mask_im = mask_im.filter(ImageFilter.GaussianBlur(1.0))
    
    rgba = im_resized.convert('RGBA')
    rgba.putalpha(mask_im)
    return rgba

def make_portrait(sprite_rgba, size=256, tier=1, rarity_idx=0):
    # Create canvas
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = size // 2, size // 2
    r = size // 2 - 4
    
    # 1. Background gradient disk
    if tier == 1:
        bg_color = (24, 32, 54, 255)
        border_color = (100, 116, 139, 255)
        inner_ring = (51, 65, 85, 255)
    elif tier == 2: # Gold
        bg_color = (45, 34, 12, 255)
        border_color = (255, 215, 0, 255)
        inner_ring = (218, 165, 32, 255)
    else: # Diamond
        bg_color = (12, 38, 55, 255)
        border_color = (0, 230, 255, 255)
        inner_ring = (56, 189, 248, 255)
        
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=bg_color)
    
    # Soft radial highlight on top half of disk
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    if tier == 2:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(255, 235, 120, 60))
    elif tier == 3:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(140, 240, 255, 60))
    else:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(255, 255, 255, 30))
    highlight = highlight.filter(ImageFilter.GaussianBlur(8))
    canvas = Image.alpha_composite(canvas, highlight)
    draw = ImageDraw.Draw(canvas)
    
    # 2. Inscribe character sprite inside circle
    # Inset by ~16px
    char_size = int(size * 0.82)
    char_resized = sprite_rgba.resize((char_size, char_size), Image.Resampling.LANCZOS)
    
    # Tier tint effect for character
    if tier == 2:
        # Gold tint
        char_arr = np.array(char_resized, dtype=np.float32)
        char_arr[:, :, 0] = np.clip(char_arr[:, :, 0] * 1.15 + 15, 0, 255)
        char_arr[:, :, 1] = np.clip(char_arr[:, :, 1] * 1.05 + 10, 0, 255)
        char_arr[:, :, 2] = np.clip(char_arr[:, :, 2] * 0.75, 0, 255)
        char_resized = Image.fromarray(char_arr.astype(np.uint8), mode='RGBA')
    elif tier == 3:
        # Diamond / Cosmic tint
        char_arr = np.array(char_resized, dtype=np.float32)
        char_arr[:, :, 0] = np.clip(char_arr[:, :, 0] * 0.85 + 10, 0, 255)
        char_arr[:, :, 1] = np.clip(char_arr[:, :, 1] * 1.1 + 15, 0, 255)
        char_arr[:, :, 2] = np.clip(char_arr[:, :, 2] * 1.3 + 30, 0, 255)
        char_resized = Image.fromarray(char_arr.astype(np.uint8), mode='RGBA')

    paste_x = (size - char_size) // 2
    paste_y = (size - char_size) // 2 + int(size * 0.03) # slightly lower for grounding
    
    # Clip to circular mask so legs or head don't bleed outside frame
    circ_mask = Image.new('L', (size, size), 0)
    cm_draw = ImageDraw.Draw(circ_mask)
    cm_draw.ellipse((cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3), fill=255)
    
    temp = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    temp.paste(char_resized, (paste_x, paste_y), char_resized)
    canvas.paste(temp, (0, 0), circ_mask)
    
    # 3. Outer border ring & bevel
    draw = ImageDraw.Draw(canvas)
    border_w = 4 if size <= 256 else 8
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=border_color, width=border_w)
    draw.ellipse((cx - r + border_w, cy - r + border_w, cx + r - border_w, cy + r - border_w), outline=inner_ring, width=2)
    
    # Tier badge emblem (small star/diamond at bottom)
    if tier == 2:
        badge_r = 10 if size <= 256 else 20
        bx, by = cx, cy + r - border_w
        draw.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=(255, 215, 0, 255), outline=(255, 255, 255, 255), width=2)
        draw_star(draw, bx, by, badge_r * 0.7, badge_r * 0.35, fill=(120, 60, 0, 255))
    elif tier == 3:
        badge_r = 10 if size <= 256 else 20
        bx, by = cx, cy + r - border_w
        draw.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=(0, 230, 255, 255), outline=(255, 255, 255, 255), width=2)
        draw_star(draw, bx, by, badge_r * 0.7, badge_r * 0.35, fill=(0, 40, 80, 255))
        
    return canvas

def make_placeholder_sprite(size=256, tier=1):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = size // 2, size // 2
    r = int(size * 0.36)
    
    # Squishy rounded cube body
    corner_r = int(r * 0.45)
    box = (cx - r, cy - r + 4, cx + r, cy + r + 4)
    
    if tier == 1:
        color = (55, 65, 81, 255)
        border = (107, 114, 128, 255)
    elif tier == 2:
        color = (180, 130, 20, 255)
        border = (255, 215, 0, 255)
    else:
        color = (14, 116, 144, 255)
        border = (56, 189, 248, 255)
        
    draw.rounded_rectangle(box, radius=corner_r, fill=color, outline=border, width=3)
    # Cute eye slits
    eye_y = cy - 2
    draw.ellipse((cx - 20, eye_y - 8, cx - 8, eye_y + 8), fill=(255, 255, 255, 220))
    draw.ellipse((cx + 8, eye_y - 8, cx + 20, eye_y + 8), fill=(255, 255, 255, 220))
    return im

print("Building all 90 mob assets...")

# 1. Generate transparent sprites (512 & 256) for the 10 skins
sprites_512 = {}
sprites_256 = {}

for mob_id in range(1, 31):
    if mob_id in SKIN_FILES and os.path.exists(SKIN_FILES[mob_id]):
        sp512 = extract_alpha_sprite(SKIN_FILES[mob_id], size=512, mob_id=mob_id)
        sp256 = sp512.resize((256, 256), Image.Resampling.LANCZOS)
    else:
        sp512 = make_placeholder_sprite(size=512, tier=1)
        sp256 = make_placeholder_sprite(size=256, tier=1)
        
    sprites_512[mob_id] = sp512
    sprites_256[mob_id] = sp256
    
    # Save base sprite
    sp512.save(f'assets/mobs/sprites/512/mob_{str(mob_id).zfill(2)}.png', 'PNG', optimize=True)
    sp256.save(f'assets/mobs/sprites/256/mob_{str(mob_id).zfill(2)}.png', 'PNG', optimize=True)

# Also create placeholder sprite
ph512 = make_placeholder_sprite(512)
ph256 = make_placeholder_sprite(256)
ph512.save('assets/mobs/sprites/512/placeholder.png', 'PNG')
ph256.save('assets/mobs/sprites/256/placeholder.png', 'PNG')

# 2. Generate portraits for all 90 levels
for level in range(1, 91):
    base_id = ((level - 1) % 30) + 1
    tier = (level - 1) // 30 + 1 # 1: Normal, 2: Gold, 3: Diamond
    sp = sprites_512[base_id]
    
    # 256 portrait (used in-game for quests, shop, collection)
    p256 = make_portrait(sp, size=256, tier=tier)
    p256.save(f'assets/mobs/portraits/256/mob_{str(level).zfill(2)}.png', 'PNG', optimize=True)
    
    # 512 portrait (only for first 10 + tier milestones, saving disk/VRAM)
    if level <= 10 or level == 31 or level == 60 or level == 61 or level == 90:
        p512 = make_portrait(sp, size=512, tier=tier)
        p512.save(f'assets/mobs/portraits/512/mob_{str(level).zfill(2)}.png', 'PNG', optimize=True)

# Also legacy compatibility paths for existing scene references (assets/mobs/256/mob_01.png etc.)
for mob_id in range(1, 11):
    sprites_256[mob_id].save(f'assets/mobs/256/mob_{str(mob_id).zfill(2)}.png', 'PNG')
    sprites_512[mob_id].save(f'assets/mobs/512/mob_{str(mob_id).zfill(2)}.png', 'PNG')

print("All mob sprites & portraits generated successfully!")
