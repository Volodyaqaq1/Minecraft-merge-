import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import collections

os.makedirs('assets/mobs/sprites/256', exist_ok=True)
os.makedirs('assets/mobs/sprites/512', exist_ok=True)
os.makedirs('assets/mobs/portraits/256', exist_ok=True)
os.makedirs('assets/mobs/portraits/512', exist_ok=True)
os.makedirs('assets/mobs/256', exist_ok=True)
os.makedirs('assets/mobs/512', exist_ok=True)

# 30 Canonical Base Mobs in exact required progression order
CANONICAL_MOBS = [
    (1,  'Цыпа',             'skins/Chicken.jpg'),
    (2,  'Хрюша',            'skins/pig.jpg'),
    (3,  'Бурёнка',          'skins/cow.jpg'),
    (4,  'Овечка',           'skins/sheep.jpg'),
    (5,  'Кролик',           'skins/rabbit.jpg'),
    (6,  'Ночница',          'skins/bat.jpg'),
    (7,  'Зомбик',           'skins/zombik.jpg'),
    (8,  'Скелетик',         'skins/Skeleton.jpg'),
    (9,  'Паучок',           'skins/Spider.jpg'),
    (10, 'Бумяш',            'skins/boomyash.jpg'),
    (11, 'Колдунья',         'skins/Witch.jpg'),
    (12, 'Циклоп',           'skins/cyclop.jpg'),
    (13, 'Костяной рыцарь',  'skins/skeletonwarrior.jpg'),
    (14, 'Теневик',          'skins/teleportik.jpg'),
    (15, 'Огонёк',           'skins/ogonek.jpg'),
    (16, 'Облачник',         'skins/cloudy.jpg'),
    (17, 'Светопаук',        'skins/GlowSpider.jpg'),
    (18, 'Магмовик',         'skins/fireslime.jpg'),
    (19, 'Трёхглав',         'skins/3head.jpg'),
    (20, 'Морской титан',    'skins/seaTitan.jpg'),
    (21, 'Громила',          'skins/bigpig.jpg'),
    (22, 'Чародей',          'skins/mag.jpg'),
    (23, 'Вепрь',            'skins/vepr.jpg'),
    (24, 'Налётчик',         'skins/evilhunter.jpg'),
    (25, 'Ледяной странник', 'skins/Stray.jpg'),
    (26, 'Ночнокрыл',        'skins/nightCrylan.jpg'),
    (27, 'Желейка',          'skins/Slime.jpg'),
    (28, 'Железный страж',   'skins/golenm.jpg'),
    (29, 'Снеговик',         'skins/Snow Golem.jpg'),
    (30, 'Древний дракон',   'skins/ancientDragon.jpg'),
]

# Elemental theme data for each base mob (for individual elemental identity)
ELEMENTAL_THEMES = {
    1:  {'element': 'fire',       'rgb': (249, 115, 22), 'bg': (38, 22, 12)},
    2:  {'element': 'magma',      'rgb': (234, 88, 12),  'bg': (36, 18, 10)},
    3:  {'element': 'nature',     'rgb': (34, 197, 94),  'bg': (14, 38, 20)},
    4:  {'element': 'ice',        'rgb': (56, 189, 248), 'bg': (12, 32, 48)},
    5:  {'element': 'wind',       'rgb': (16, 185, 129), 'bg': (12, 36, 26)},
    6:  {'element': 'shadow',     'rgb': (99, 102, 241), 'bg': (22, 20, 48)},
    7:  {'element': 'plague',     'rgb': (101, 163, 13), 'bg': (20, 30, 10)},
    8:  {'element': 'spectral',   'rgb': (147, 197, 253),'bg': (18, 28, 46)},
    9:  {'element': 'poison',     'rgb': (168, 85, 247), 'bg': (32, 16, 48)},
    10: {'element': 'electric',   'rgb': (14, 165, 233), 'bg': (10, 28, 46)},
    11: {'element': 'arcane',     'rgb': (192, 132, 252),'bg': (32, 18, 48)},
    12: {'element': 'ocean',      'rgb': (2, 132, 199),  'bg': (10, 28, 44)},
    13: {'element': 'cursed',     'rgb': (71, 85, 105),  'bg': (18, 22, 30)},
    14: {'element': 'void',       'rgb': (147, 51, 234), 'bg': (28, 12, 48)},
    15: {'element': 'solar',      'rgb': (251, 191, 36), 'bg': (42, 30, 10)},
    16: {'element': 'storm',      'rgb': (59, 130, 246), 'bg': (14, 24, 48)},
    17: {'element': 'crystal',    'rgb': (6, 182, 212),  'bg': (10, 32, 42)},
    18: {'element': 'infernal',   'rgb': (245, 158, 11), 'bg': (40, 26, 10)},
    19: {'element': 'nether',     'rgb': (67, 56, 202),  'bg': (18, 16, 42)},
    20: {'element': 'abyss',      'rgb': (15, 118, 110), 'bg': (8, 28, 28)},
    21: {'element': 'lava',       'rgb': (239, 68, 68),  'bg': (40, 14, 16)},
    22: {'element': 'arcane',     'rgb': (168, 85, 247), 'bg': (30, 16, 46)},
    23: {'element': 'earth',      'rgb': (180, 83, 9),   'bg': (35, 20, 10)},
    24: {'element': 'shadow',     'rgb': (100, 116, 139),'bg': (20, 24, 32)},
    25: {'element': 'frost',      'rgb': (103, 232, 249),'bg': (12, 34, 46)},
    26: {'element': 'void',       'rgb': (124, 58, 237), 'bg': (24, 14, 46)},
    27: {'element': 'toxic',      'rgb': (132, 204, 22), 'bg': (22, 34, 10)},
    28: {'element': 'earth',      'rgb': (5, 150, 105),  'bg': (10, 30, 24)},
    29: {'element': 'ancient_ice','rgb': (125, 211, 252),'bg': (14, 32, 46)},
    30: {'element': 'cosmic',     'rgb': (109, 40, 217), 'bg': (24, 10, 48)},
}

def draw_star(draw, cx, cy, r_outer, r_inner, fill, outline=None, width=1):
    points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=fill, outline=outline, width=width)

FEET_CUTOFF = {
    1: 443, 2: 444, 3: 428, 4: 428, 5: 449,
    6: 400, 7: 445, 8: 427, 9: 396, 10: 429,
    11: 438, 12: 442, 13: 456, 14: 422, 15: 410,
    16: 420, 17: 415, 18: 442, 19: 450, 20: 464,
    21: 458, 22: 467, 23: 466, 24: 461, 25: 454,
    26: 400, 27: 428, 28: 483, 29: 461, 30: 470
}

def extract_alpha_sprite(src_path, base_id=1, size=512):
    im = Image.open(src_path).convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    
    top = arr[0, :, :]; bottom = arr[-1, :, :]; left = arr[:, 0, :]; right = arr[:, -1, :]
    yw = np.linspace(0, 1, h)[:, None, None]; xw = np.linspace(0, 1, w)[None, :, None]
    bg_vert = (1 - yw)*top[None, :, :] + yw*bottom[None, :, :]
    bg_horiz = (1 - xw)*left[:, None, :] + xw*right[:, None, :]
    c_blend = (1 - yw)*(1 - xw)*arr[0,0] + (1 - yw)*xw*arr[0,-1] + yw*(1 - xw)*arr[-1,0] + yw*xw*arr[-1,-1]
    bg_model = bg_vert + bg_horiz - c_blend
    dist = np.linalg.norm(arr - bg_model, axis=2)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    max_diff = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    
    is_white_mob = base_id in (1, 3, 4, 8, 16, 25, 29)
    if base_id == 15: # Ogonek
        is_bg = (b > 170) & (r > 200) & (g > 185) | (dist < 8.0)
    elif base_id == 11: # Witch
        is_bg = (dist < 11.0) & (max_diff <= 12)
    elif base_id == 1: # Chicken
        is_bg = (dist < 9.0) & (max_diff <= 8)
    elif base_id == 25: # Stray
        is_bg = (dist < 7.5) & (max_diff <= 8)
    elif is_white_mob:
        is_bg = (dist < 6.2) & (max_diff <= 6)
    else:
        is_bg = (dist < 9.5) & (max_diff <= 9)
        
    y_coords = np.arange(h)[:, None]
    x_coords = np.arange(w)[None, :]
    
    max_feet = FEET_CUTOFF.get(base_id, 450)
    is_bg = is_bg | (y_coords > max_feet)
    
    if base_id == 1: # Chicken
        is_yellow_foot = (r > 160) & (g > 100) & (b < 100) & (max_diff > 40)
        chicken_floor = (y_coords > 405) & ~is_yellow_foot
        chicken_sides = (y_coords > 380) & ((x_coords > 330) | (x_coords < 130))
        is_bg = is_bg | chicken_floor | chicken_sides
    elif base_id == 8: # Skeleton
        in_left_foot = (x_coords >= 140) & (x_coords <= 236) & (y_coords <= 425)
        in_right_foot = (x_coords >= 265) & (x_coords <= 348) & (y_coords <= 427)
        skel_sides = (y_coords > 360) & ((x_coords < 140) | (x_coords > 350))
        skel_between = (y_coords > 398) & (x_coords > 236) & (x_coords < 265)
        skel_below = (y_coords > 427)
        is_bg = is_bg | skel_sides | skel_below | skel_between | ((y_coords > 400) & ~in_left_foot & ~in_right_foot)
    elif base_id == 14: # Teleportik
        is_bg = is_bg | ((y_coords > 400) & (lum > 60))
    elif base_id == 16: # Cloudy
        is_bg = is_bg | (y_coords > 420)
    elif base_id == 17: # GlowSpider
        glow_right = (
            ((y_coords > 320) & (x_coords > 445)) |
            ((y_coords > 365) & (x_coords > 425)) |
            ((y_coords > 385) & (x_coords > 380)) |
            ((y_coords > 395) & (x_coords > 355))
        )
        glow_left = (
            ((y_coords > 360) & (x_coords < 105)) |
            ((y_coords > 395) & (x_coords < 240))
        )
        is_bg = is_bg | glow_right | glow_left | ((y_coords > 390) & (x_coords >= 220) & (x_coords <= 315))
        is_bg = is_bg | ((y_coords > 370) & (lum > 70) & (max_diff <= 16))
    elif base_id == 27: # Slime
        is_left_foot = (x_coords >= 145) & (x_coords <= 225) & (y_coords <= 415)
        is_mid_foot = (x_coords >= 235) & (x_coords <= 315) & (y_coords <= 428)
        is_back_foot = (x_coords >= 315) & (x_coords <= 355) & (y_coords <= 400)
        is_slime_floor = (y_coords > 395) & ~is_left_foot & ~is_mid_foot & ~is_back_foot
        is_bg = is_bg | is_slime_floor | (y_coords > 428)
        is_bg = is_bg | ((y_coords > 370) & (x_coords < 155))
        is_bg = is_bg | ((y_coords > 360) & (x_coords > 340))
    elif base_id == 29: # Snow Golem
        snow_sides = (y_coords > 385) & ((x_coords < 125) | (x_coords > 380))
        dx = (x_coords - 256.0) / 135.0
        dy = (y_coords - 380.0) / 82.0
        outside_snowball = (dx*dx + dy*dy > 1.0) & (y_coords > 385)
        is_bg = is_bg | snow_sides | outside_snowball
    elif base_id in (2, 5, 7, 10, 21, 23, 24):
        floor = (y_coords > 380) & (lum > 80) & (max_diff <= 16)
        is_bg = is_bg | floor
    elif base_id in (3, 4, 9, 11, 12, 13, 18, 20, 22, 25, 28, 30):
        floor = (y_coords > 370) & (lum > 80) & (max_diff <= 16)
        is_bg = is_bg | floor

    visited = np.zeros((h, w), dtype=bool)
    queue = collections.deque()
    for x in range(w):
        if is_bg[0, x]: queue.append((0, x)); visited[0, x] = True
        if is_bg[h-1, x]: queue.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if is_bg[y, 0] and not visited[y, 0]: queue.append((y, 0)); visited[y, 0] = True
        if is_bg[y, w-1] and not visited[y, w-1]: queue.append((y, w-1)); visited[y, w-1] = True
        
    while queue:
        cy, cx = queue.popleft()
        for ny, nx in ((cy+1, cx), (cy-1, cx), (cy, cx+1), (cy, cx-1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))
                
    fg = ~visited
    mask_im = Image.fromarray((fg * 255).astype(np.uint8), mode='L')
    opened = mask_im.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    closed = opened.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    
    alpha_final = closed.filter(ImageFilter.GaussianBlur(0.6))
    out_rgba = Image.fromarray(arr.astype(np.uint8), mode='RGB').convert('RGBA')
    out_rgba.putalpha(alpha_final)
    return out_rgba

def create_elemental_sprite(base_rgba, base_id):
    # Magical elemental transformation adhering to Part 5 rules:
    # Controlled subtle tint, glowing eye/accent highlight, preserved silhouette
    theme = ELEMENTAL_THEMES.get(base_id, {'rgb': (56, 189, 248), 'bg': (12, 32, 48)})
    el_rgb = theme['rgb']
    
    arr = np.array(base_rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 20
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    
    # Blend with elemental accent color based on luminance
    target_r = el_rgb[0]
    target_g = el_rgb[1]
    target_b = el_rgb[2]
    
    # 25% elemental color shift preserving underlying texture and character identity
    arr[mask, 0] = np.clip(r[mask] * 0.72 + target_r * 0.28 * (0.6 + 0.4 * luminance[mask]), 0, 255)
    arr[mask, 1] = np.clip(g[mask] * 0.72 + target_g * 0.28 * (0.6 + 0.4 * luminance[mask]), 0, 255)
    arr[mask, 2] = np.clip(b[mask] * 0.72 + target_b * 0.28 * (0.6 + 0.4 * luminance[mask]), 0, 255)
    
    return Image.fromarray(arr.astype(np.uint8), mode='RGBA')

def create_golden_sprite(base_rgba):
    # Elite, prestigious, luxurious gold transformation adhering to Part 6 rules:
    # Premium polished gold surfaces, warm metallic sheen, clean silhouette
    arr = np.array(base_rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 20
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    
    # Polished gold material (warm golden highlights + dark bronze shadows)
    gold_r = np.clip(luminance * 240 + 35, 0, 255)
    gold_g = np.clip(luminance * 200 + 15, 0, 255)
    gold_b = np.clip(luminance * 70, 0, 255)
    
    # 45% blend with original identity so eyes and distinct shapes remain recognizable
    arr[mask, 0] = np.clip(r[mask] * 0.50 + gold_r[mask] * 0.50, 0, 255)
    arr[mask, 1] = np.clip(g[mask] * 0.50 + gold_g[mask] * 0.50, 0, 255)
    arr[mask, 2] = np.clip(b[mask] * 0.40 + gold_b[mask] * 0.60, 0, 255)
    
    return Image.fromarray(arr.astype(np.uint8), mode='RGBA')

def make_portrait(sprite_rgba, size=256, evolution_tier=1, base_id=1):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    cx, cy = size // 2, size // 2
    r = size // 2 - 4
    
    theme = ELEMENTAL_THEMES.get(base_id, {'rgb': (56, 189, 248), 'bg': (12, 32, 48)})
    el_rgb = theme['rgb']
    el_bg = theme['bg']
    
    # 1. Background gradient disk
    if evolution_tier == 1:
        # Ordinary: Clean dark slate
        bg_color = (24, 32, 54, 255)
        border_color = (100, 116, 139, 255)
        inner_ring = (51, 65, 85, 255)
    elif evolution_tier == 2:
        # Elemental: Individual elemental color palette
        bg_color = (el_bg[0], el_bg[1], el_bg[2], 255)
        border_color = (el_rgb[0], el_rgb[1], el_rgb[2], 255)
        inner_ring = (int(el_rgb[0] * 0.7), int(el_rgb[1] * 0.7), int(el_rgb[2] * 0.7), 255)
    else:
        # Golden: Elite royal obsidian & polished gold
        bg_color = (32, 24, 10, 255)
        border_color = (255, 215, 0, 255)
        inner_ring = (218, 165, 32, 255)
        
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=bg_color)
    
    # Soft radial highlight on top half of disk
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    if evolution_tier == 2:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(el_rgb[0], el_rgb[1], el_rgb[2], 55))
    elif evolution_tier == 3:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(255, 235, 120, 70))
    else:
        hdraw.ellipse((cx - r + 10, cy - r + 6, cx + r - 10, cy + 10), fill=(255, 255, 255, 30))
    highlight = highlight.filter(ImageFilter.GaussianBlur(8))
    canvas = Image.alpha_composite(canvas, highlight)
    draw = ImageDraw.Draw(canvas)
    
    # 2. Inscribe character sprite inside circle
    char_size = int(size * 0.82)
    char_resized = sprite_rgba.resize((char_size, char_size), Image.Resampling.LANCZOS)
    
    paste_x = (size - char_size) // 2
    paste_y = (size - char_size) // 2 + int(size * 0.03)
    
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
    
    # Evolution tier badge emblem at bottom
    if evolution_tier == 2:
        badge_r = 10 if size <= 256 else 20
        bx, by = cx, cy + r - border_w
        draw.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=border_color, outline=(255, 255, 255, 255), width=2)
        # 4-point elemental diamond
        draw.polygon([(bx, by - badge_r * 0.65), (bx + badge_r * 0.65, by), (bx, by + badge_r * 0.65), (bx - badge_r * 0.65, by)], fill=(15, 23, 42, 255))
    elif evolution_tier == 3:
        badge_r = 10 if size <= 256 else 20
        bx, by = cx, cy + r - border_w
        draw.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=(255, 215, 0, 255), outline=(255, 255, 255, 255), width=2)
        draw_star(draw, bx, by, badge_r * 0.7, badge_r * 0.35, fill=(120, 60, 0, 255))
        
    return canvas

def make_placeholder_sprite(size=256):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = size // 2, size // 2
    r = int(size * 0.36)
    corner_r = int(r * 0.45)
    box = (cx - r, cy - r + 4, cx + r, cy + r + 4)
    draw.rounded_rectangle(box, radius=corner_r, fill=(55, 65, 81, 255), outline=(107, 114, 128, 255), width=3)
    eye_y = cy - 2
    draw.ellipse((cx - 20, eye_y - 8, cx - 8, eye_y + 8), fill=(255, 255, 255, 220))
    draw.ellipse((cx + 8, eye_y - 8, cx + 20, eye_y + 8), fill=(255, 255, 255, 220))
    return im

def main():
    print("Starting generation of all 30 base mobs across 3 evolutions (90 progression tiers)...")

    base_sprites_512 = {}
    base_sprites_256 = {}
    elemental_sprites_256 = {}
    golden_sprites_256 = {}

    # 1. Process 30 canonical base mob skins
    for base_id, name, skin_path in CANONICAL_MOBS:
        pad = str(base_id).zfill(2)
        if os.path.exists(skin_path):
            sp512 = extract_alpha_sprite(skin_path, base_id=base_id, size=512)
            sp256 = sp512.resize((256, 256), Image.Resampling.LANCZOS)
        else:
            print(f"WARNING: Skin {skin_path} not found! Using fallback.")
            sp512 = make_placeholder_sprite(512)
            sp256 = make_placeholder_sprite(256)
            
        base_sprites_512[base_id] = sp512
        base_sprites_256[base_id] = sp256
        
        # Save Ordinary gameplay sprites
        sp512.save(f'assets/mobs/sprites/512/mob_{pad}.png', 'PNG', optimize=True)
        sp256.save(f'assets/mobs/sprites/256/mob_{pad}.png', 'PNG', optimize=True)
        sp256.save(f'assets/mobs/sprites/256/mob_ordinary_{pad}.png', 'PNG', optimize=True)
        
        # Generate and save Elemental & Golden gameplay sprites
        el256 = create_elemental_sprite(sp256, base_id)
        go256 = create_golden_sprite(sp256)
        elemental_sprites_256[base_id] = el256
        golden_sprites_256[base_id] = go256
        
        el256.save(f'assets/mobs/sprites/256/mob_elemental_{pad}.png', 'PNG', optimize=True)
        go256.save(f'assets/mobs/sprites/256/mob_golden_{pad}.png', 'PNG', optimize=True)
        
        # Also save to legacy paths for backwards compatibility
        sp256.save(f'assets/mobs/256/mob_{pad}.png', 'PNG')
        sp512.save(f'assets/mobs/512/mob_{pad}.png', 'PNG')

    # Placeholder sprites
    ph512 = make_placeholder_sprite(512)
    ph256 = make_placeholder_sprite(256)
    ph512.save('assets/mobs/sprites/512/placeholder.png', 'PNG')
    ph256.save('assets/mobs/sprites/256/placeholder.png', 'PNG')

    # 2. Generate portraits for all 90 levels
    for level in range(1, 91):
        base_id = ((level - 1) % 30) + 1
        evolution_tier = (level - 1) // 30 + 1 # 1: Ordinary, 2: Elemental, 3: Golden
        pad_lvl = str(level).zfill(2)
        
        if evolution_tier == 1:
            sprite_for_portrait = base_sprites_512[base_id]
        elif evolution_tier == 2:
            sprite_for_portrait = create_elemental_sprite(base_sprites_512[base_id], base_id)
        else:
            sprite_for_portrait = create_golden_sprite(base_sprites_512[base_id])
            
        p256 = make_portrait(sprite_for_portrait, size=256, evolution_tier=evolution_tier, base_id=base_id)
        p256.save(f'assets/mobs/portraits/256/mob_{pad_lvl}.png', 'PNG', optimize=True)
        
        # 512 portrait for milestones
        if level in (1, 30, 31, 60, 61, 90) or level <= 10:
            p512 = make_portrait(sprite_for_portrait, size=512, evolution_tier=evolution_tier, base_id=base_id)
            p512.save(f'assets/mobs/portraits/512/mob_{pad_lvl}.png', 'PNG', optimize=True)

    print("SUCCESS: All 30 base mobs and 90 evolution portraits successfully generated!")

if __name__ == '__main__':
    main()
