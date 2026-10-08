"""Rohbilder aus Bilder_roh/ für die Website aufbereiten.

Aufruf:  python tools/bilder.py
- Tier-Avatare (z. B. tiger.png)   -> hub/assets/img/animals/tiger.webp   (480 px)
- Stempel (START.png, SPR.png …)   -> hub/assets/img/stamps/SPR.webp      (600 px, einheitliche Tintenfarbe)
- Abzeichen (levelup.png …)        -> hub/assets/img/badges/levelup.webp  (300 px)
- Postkarten (POST-SPR.png …)      -> hub/assets/img/SPR.webp             (1200 px breit)
Dateiname entscheidet. Die Endung ist egal (.png/.jpg). Originale bleiben unverändert in Bilder_roh/.
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'Bilder_roh')
IMG = os.path.join(ROOT, 'hub', 'assets', 'img')
CONFIG = os.path.join(ROOT, 'hub', 'config.json')

ANIMALS = {'wolf', 'bear', 'tiger', 'lion', 'shark', 'eagle', 'falcon', 'cobra', 'viper', 'rhino', 'gorilla', 'jaguar', 'panther', 'orca', 'lynx',
           'panda', 'bunny', 'kitten', 'puppy', 'otter', 'hamster', 'penguin', 'fawn', 'lamb', 'alpaca', 'hedgehog', 'squirrel', 'dolphin', 'seal', 'fox', 'koala'}
BADGES = {'levelup', 'allfive', 'stars'}
SRC_TIME = [0]


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def save_webp(im, path, size, quality=82):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and os.path.getmtime(path) > SRC_TIME[0]:
        return os.path.getsize(path) // 1024   # schon aktuell
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    return os.path.getsize(path) // 1024


def clean_stamp(im, ink):
    """Alle sichtbaren Pixel in EINER Tintenfarbe, Streupixel (fast transparent) entfernen."""
    im = im.convert('RGBA')
    r, g, b = hex_rgb(ink)
    alpha = im.getchannel('A').point(lambda a: 0 if a < 90 else min(255, int(a * 1.1)))
    out = Image.new('RGBA', im.size, (r, g, b, 0))
    out.putalpha(alpha)
    return out


def main():
    cfg = json.load(open(CONFIG, encoding='utf-8'))
    topics = cfg['topics']
    bonus = cfg.get('bonus', {})
    changed = False
    for f in sorted(os.listdir(RAW)):
        name, _ = os.path.splitext(f)
        SRC_TIME[0] = os.path.getmtime(os.path.join(RAW, f))
        src = Image.open(os.path.join(RAW, f)).convert('RGBA')
        low = name.lower()
        if low in ANIMALS:
            kb = save_webp(src, os.path.join(IMG, 'animals', f'{low}.webp'), 480)
            print(f'Avatar   {f:16} -> animals/{low}.webp ({kb} KB)')
        elif name.upper() in topics or name.upper() in bonus:
            tid = name.upper()
            t = topics.get(tid) or bonus.get(tid)
            ink = (t.get('stamp') or {}).get('ink', '#1F5F68')
            kb = save_webp(clean_stamp(src, ink), os.path.join(IMG, 'stamps', f'{tid}.webp'), 600, quality=88)
            t.setdefault('stamp', {})['image'] = f'assets/img/stamps/{tid}.webp'
            changed = True
            print(f'Stempel  {f:16} -> stamps/{tid}.webp ({kb} KB, Tinte {ink})')
        elif low in BADGES:
            kb = save_webp(src, os.path.join(IMG, 'badges', f'{low}.webp'), 300)
            for a in cfg.get('achievements', []):
                if a['id'] == low:
                    a['image'] = f'assets/img/badges/{low}.webp'
                    changed = True
            print(f'Abzeichen {f:15} -> badges/{low}.webp ({kb} KB)')
        elif name.upper().startswith('POST-') and name.upper()[5:] in topics:
            tid = name.upper()[5:]
            im = src.convert('RGB')
            im.thumbnail((1200, 1200), Image.LANCZOS)
            path = os.path.join(IMG, f'{tid}.webp')
            if not (os.path.exists(path) and os.path.getmtime(path) > SRC_TIME[0]):
                im.save(path, 'WEBP', quality=80, method=6)
            topics[tid]['image'] = f'assets/img/{tid}.webp'
            changed = True
            print(f'Postkarte {f:15} -> {tid}.webp ({os.path.getsize(path) // 1024} KB)')
        else:
            print(f'??       {f:16} nicht zugeordnet (Dateiname prüfen)', file=sys.stderr)
    if changed:
        with open(CONFIG, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(cfg, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        print('config.json aktualisiert')


if __name__ == '__main__':
    main()
