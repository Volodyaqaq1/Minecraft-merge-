import os
import glob
from PIL import Image, ImageDraw

os.makedirs('assets/mobs/512', exist_ok=True)
os.makedirs('assets/mobs/256', exist_ok=True)
os.makedirs('assets/icons', exist_ok=True)

# 1. Manifest of existing skins in skins/
SKINS = {
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

def make_circle_mask(size):
    mask = Image.new('L', (size * 2, size * 2), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((4, 4, size * 2 - 5, size * 2 - 5), fill=255)
    return mask.resize((size, size), Image.Resampling.LANCZOS)

def process_skin_file(src_path, mob_id):
    if not os.path.exists(src_path):
        print(f"Warning: {src_path} not found")
        return
        
    im = Image.open(src_path).convert('RGB')
    w, h = im.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    cropped = im.crop((left, top, left + min_dim, top + min_dim))
    
    # 512x512
    im512 = cropped.resize((512, 512), Image.Resampling.LANCZOS)
    mask512 = make_circle_mask(512)
    out512 = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    out512.paste(im512, (0, 0), mask512)
    draw512 = ImageDraw.Draw(out512)
    draw512.ellipse((3, 3, 508, 508), outline=(255, 255, 255, 220), width=6)
    
    path512_png = f'assets/mobs/512/mob_{str(mob_id).zfill(2)}.png'
    out512.save(path512_png, 'PNG', optimize=True)
    
    # 256x256
    im256 = cropped.resize((256, 256), Image.Resampling.LANCZOS)
    mask256 = make_circle_mask(256)
    out256 = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    out256.paste(im256, (0, 0), mask256)
    draw256 = ImageDraw.Draw(out256)
    draw256.ellipse((2, 2, 253, 253), outline=(255, 255, 255, 220), width=3)
    
    path256_png = f'assets/mobs/256/mob_{str(mob_id).zfill(2)}.png'
    out256.save(path256_png, 'PNG', optimize=True)
    
    print(f"Processed mob {mob_id} from {src_path} -> 512 & 256 PNGs")

def create_neutral_placeholder(size=256):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = size // 2, size // 2
    r = size // 2 - 4
    
    # Neutral sleek dark background
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(30, 41, 59, 255), outline=(71, 85, 105, 255), width=4)
    # Inner ring
    draw.ellipse((cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8), outline=(51, 65, 85, 255), width=2)
    # Question mark / mystery icon
    draw.text((cx, cy - 8), '?', fill=(148, 163, 184, 255), anchor='mm', font_size=int(size * 0.45))
    
    im.save('assets/mobs/placeholder.png', 'PNG')
    # Also save 512
    im512 = im.resize((512, 512), Image.Resampling.LANCZOS)
    im512.save('assets/mobs/512/placeholder.png', 'PNG')
    im.save('assets/mobs/256/placeholder.png', 'PNG')
    print("Created neutral development placeholder")

# Process all 10 existing skins
for mob_id, path in SKINS.items():
    process_skin_file(path, mob_id)

create_neutral_placeholder()
print("Mob asset generation complete!")
