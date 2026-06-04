from PIL import Image, ImageDraw

BG   = (251, 249, 244)
SUN  = (248, 194, 132)
ACC  = (227, 101, 88)
BRK  = (119, 194, 230)
SAT  = (113, 193, 152)
MOON = (163, 153, 223)

CHIP_COLORS = [
  [SUN,  ACC,  BRK,  SAT],
  [MOON, SUN,  ACC,  BRK],
  [SAT,  MOON, SUN,  ACC],
  [BRK,  SAT,  MOON, SUN],
]

COL_X = [0, 1, 4, 5]

def make_icon(size):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    d   = ImageDraw.Draw(img)
    scale = size / 512
    r = int(112 * scale)
    d.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=BG)
    pad = 64 * scale
    gap = 10 * scale
    cw  = 55.67 * scale
    ch  = 68.8  * scale
    xs = [pad + ci * (cw + gap) for ci in COL_X]
    ys = [142.8 * scale + ri * (ch + gap) for ri in range(4)]
    rx = int(16 * scale)
    for ri, row in enumerate(CHIP_COLORS):
        for ci, color in enumerate(row):
            x, y = xs[ci], ys[ri]
            d.rounded_rectangle([x, y, x+cw, y+ch], radius=rx, fill=color)
    return img

for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    make_icon(size).save('public/icons/' + name)
    print('Generated ' + name)
