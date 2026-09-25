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
    (2,  'Кролик',           'skins/rabbit.jpg'),
    (3,  'Хрюша',            'skins/pig.jpg'),
    (4,  'Бурёнка',          'skins/cow.jpg'),
    (5,  'Овечка',           'skins/sheep.jpg'),
    (6,  'Летучая мышка',    'skins/bat.jpg'),
    (7,  'Желейка',          'skins/Slime.jpg'),
    (8,  'Паучок',           'skins/Spider.jpg'),
    (9,  'Пещерник',         'skins/CaveSpider.jpg'),
    (10, 'Бумик',            'skins/crepper.jpg'),
    (11, 'Зомбик',           'skins/Zombie.jpg'),
    (12, 'Скелетик',         'skins/Skeleton.jpg'),
    (13, 'Ледяной странник', 'skins/Stray.jpg'),
    (14, 'Снеговик',         'skins/Snow Golem.jpg'),
    (15, 'Колдунья',         'skins/Witch.jpg'),
    (16, 'Разбойник',        'skins/Pillager.jpg'),
    (17, 'Громила',          'skins/PiglinBrute.jpg'),
    (18, 'Вепрь',            'skins/Hoglin.jpg'),
    (19, 'Лавовый куб',      'skins/Magma Cube.jpg'),
    (20, 'Огонёк',           'skins/Blaze.jpg'),
    (21, 'Призрак',          'skins/Ghast.jpg'),
    (22, 'Чародей',          'skins/Evoker.jpg'),
    (23, 'Циклоп',           'skins/Guardian.jpg'),
    (24, 'Морской титан',    'skins/ElderGuardian.jpg'),
    (25, 'Ночной крылан',    'skins/Phantom.jpg'),
    (26, 'Телепорт',         'skins/EnderMan.jpg'),
    (27, 'Тёмный рыцарь',    'skins/WitherSkeleton.jpg'),
    (28, 'Железный страж',   'skins/Iron Golem.jpg'),
    (29, 'Трёхглавый',       'skins/Wither.jpg'),
    (30, 'Древний Дракон',   'skins/EnderDragon.jpg'),
]

# Elemental theme data for each base mob (for individual elemental identity)
ELEMENTAL_THEMES = {
    1:  {'element': 'fire',       'rgb': (249, 115, 22), 'bg': (38, 22, 12)},
    2:  {'element': 'wind',       'rgb': (16, 185, 129), 'bg': (12, 36, 26)},
    3:  {'element': 'magma',      'rgb': (234, 88, 12),  'bg': (36, 18, 10)},
    4:  {'element': 'nature',     'rgb': (34, 197, 94),  'bg': (14, 38, 20)},
    5:  {'element': 'ice',        'rgb': (56, 189, 248), 'bg': (12, 32, 48)},
    6:  {'element': 'shadow',     'rgb': (99, 102, 241), 'bg': (22, 20, 48)},
    7:  {'element': 'toxic',      'rgb': (132, 204, 22), 'bg': (22, 34, 10)},
    8:  {'element': 'poison',     'rgb': (168, 85, 247), 'bg': (32, 16, 48)},
    9:  {'element': 'crystal',    'rgb': (6, 182, 212),  'bg': (10, 32, 42)},
    10: {'element': 'electric',   'rgb': (14, 165, 233), 'bg': (10, 28, 46)},
    11: {'element': 'plague',     'rgb': (101, 163, 13), 'bg': (20, 30, 10)},
    12: {'element': 'spectral',   'rgb': (147, 197, 253),'bg': (18, 28, 46)},
    13: {'element': 'frost',      'rgb': (103, 232, 249),'bg': (12, 34, 46)},
    14: {'element': 'ancient_ice','rgb': (125, 211, 252),'bg': (14, 32, 46)},
    15: {'element': 'arcane',     'rgb': (192, 132, 252),'bg': (32, 18, 48)},
    16: {'element': 'storm',      'rgb': (59, 130, 246), 'bg': (14, 24, 48)},
    17: {'element': 'lava',       'rgb': (239, 68, 68),  'bg': (40, 14, 16)},
    18: {'element': 'magma',      'rgb': (217, 119, 6),  'bg': (38, 22, 10)},
    19: {'element': 'infernal',   'rgb': (245, 158, 11), 'bg': (40, 26, 10)},
    20: {'element': 'solar',      'rgb': (251, 191, 36), 'bg': (42, 30, 10)},
    21: {'element': 'spectral',   'rgb': (224, 231, 255),'bg': (24, 26, 44)},
    22: {'element': 'arcane',     'rgb': (168, 85, 247), 'bg': (30, 16, 46)},
    23: {'element': 'ocean',      'rgb': (2, 132, 199),  'bg': (10, 28, 44)},
    24: {'element': 'abyss',      'rgb': (15, 118, 110), 'bg': (8, 28, 28)},
    25: {'element': 'void',       'rgb': (124, 58, 237), 'bg': (24, 14, 46)},
    26: {'element': 'void',       'rgb': (147, 51, 234), 'bg': (28, 12, 48)},
    27: {'element': 'cursed',     'rgb': (71, 85, 105),  'bg': (18, 22, 30)},
    28: {'element': 'earth',      'rgb': (5, 150, 105),  'bg': (10, 30, 24)},
    29: {'element': 'nether',     'rgb': (67, 56, 202),  'bg': (18, 16, 42)},
    30: {'element': 'cosmic',     'rgb': (109, 40, 217), 'bg': (24, 10, 48)},
}

def draw_star(draw, cx, cy, r_outer, r_inner, fill, outline=None, width=1):
    points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=fill, outline=outline, width=width)

def extract_alpha_sprite(src_path, base_id=1, size=512):
    im = Image.open(src_path).convert('RGB')
    im_resized = im.resize((size, size), Image.Resampling.LANCZOS)
    arr = np.array(im_resized, dtype=np.float32)
    h, w, _ = arr.shape
    
    # 1. Coons patch transfinite background model from outer borders
    top = arr[0, :, :]
    bottom = arr[-1, :, :]
    left = arr[:, 0, :]
    right = arr[:, -1, :]
    
    y_weights = np.linspace(0, 1, h)[:, np.newaxis, np.newaxis]
    x_weights = np.linspace(0, 1, w)[np.newaxis, :, np.newaxis]
    
    bg_vert = (1 - y_weights) * top[np.newaxis, :, :] + y_weights * bottom[np.newaxis, :, :]
    bg_horiz = (1 - x_weights) * left[:, np.newaxis, :] + x_weights * right[:, np.newaxis, :]
    corner_blend = (
        (1 - y_weights) * (1 - x_weights) * arr[0, 0] +
        (1 - y_weights) * x_weights * arr[0, -1] +
        y_weights * (1 - x_weights) * arr[-1, 0] +
        y_weights * x_weights * arr[-1, -1]
    )
    bg_model = bg_vert + bg_horiz - corner_blend
    dist_to_bg = np.linalg.norm(arr - bg_model, axis=2)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    max_diff = np.maximum.reduce([np.abs(r - g), np.abs(g - b), np.abs(r - b)])
    
    # Border margin distance check
    border_mask = np.zeros((h, w), dtype=bool)
    border_mask[:15, :] = True; border_mask[-15:, :] = True; border_mask[:, :15] = True; border_mask[:, -15:] = True
    b_max = dist_to_bg[border_mask].max()
    
    # Adaptive threshold: conservative for white-body mobs to guarantee zero alpha holes
    is_white_mob = base_id in (1, 4, 5, 12, 14, 21)
    if is_white_mob:
        thresh = 6.2
    elif base_id == 15: # Witch hat edge
        thresh = 9.0
    else:
        thresh = max(8.0, min(12.0, b_max + 1.0))
        
    is_bg = (dist_to_bg < thresh) & (max_diff <= 6)
    
    # Studio floor cleanup (rows > 360)
    if base_id != 14: # Do not trim snowman's bottom snowball
        floor_bg_outside = (lum > 170) & (max_diff <= 16) & ((np.arange(w) < 145) | (np.arange(w) > 365))[np.newaxis, :]
        floor_bg_inside = (lum > 185) & (max_diff <= 6)
        is_bg[360:, :] = is_bg[360:, :] | floor_bg_outside[360:, :] | floor_bg_inside[360:, :]
        
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
    closed_mask = mask_im.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    fg_arr = np.array(closed_mask) > 128
    
    # Silhouette horizontal bounds
    sig_upper = ((max_diff > 8) | (dist_to_bg > 20))[int(h * 0.10):int(h * 0.70), :]
    y_sig, x_sig = np.where(sig_upper)
    if len(x_sig) > 0:
        char_left = max(0, x_sig.min() - 8)
        char_right = min(w - 1, x_sig.max() + 8)
    else:
        char_left = int(w * 0.15)
        char_right = int(w * 0.85)
    char_cx = (char_left + char_right) // 2
    char_hw = (char_right - char_left) // 2
        
    # Ambient occlusion ground contact row
    row_mins = [lum[y, char_left:char_right+1].min() if char_right > char_left else 255 for y in range(380, 460)]
    y_contact = 380 + np.argmin(row_mins) if len(row_mins) > 0 else int(h * 0.82)
    feet_y = min(y_contact + 4, int(h * 0.88))
    
    alpha = np.zeros((h, w), dtype=np.uint8)
    
    # 2. Solid character body up to feet_y
    for y in range(feet_y + 1):
        for x in range(char_left, char_right + 1):
            if fg_arr[y, x]:
                if base_id != 14 and y > 375 and (x < 145 or x > 365) and lum[y, x] > 170:
                    continue
                alpha[y, x] = 255
                
    # 3. Soft centered contact shadow under feet
    for y in range(feet_y - 6, min(h, feet_y + 25)):
        for x in range(char_left, char_right + 1):
            if alpha[y, x] < 255:
                lum_diff = np.mean(bg_model[y, x]) - lum[y, x]
                if lum_diff > 12.0:
                    dx = (x - char_cx) / float(char_hw)
                    dy = (y - feet_y) / 16.0
                    r_dist = dx*dx + dy*dy
                    if r_dist < 1.0:
                        s_alpha = int(np.clip(lum_diff * 3.5 * (1.0 - r_dist), 0, 150))
                        alpha[y, x] = s_alpha
                        arr[y, x] = [20, 20, 25] # Neutral dark shadow
                            
    alpha_final = Image.fromarray(alpha, mode='L').filter(ImageFilter.GaussianBlur(0.7))
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
