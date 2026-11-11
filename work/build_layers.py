# Merge full-frame + high-res lower-body mattes, clean the arm edges, and build
# per-frame realism layers: desk contact shadow, wall shadow, warm light-wrap.
import os, sys, cv2, numpy as np
W = "/home/user/Testvidei/work"
PUB = f"{W}/mg/public"
for d in ("mmask", f"{PUB}/sh", f"{PUB}/wr"): os.makedirs(d if d.startswith("/") else f"{W}/{d}", exist_ok=True)
Y0, DESK = 1100, 1488
H, WD = 1920, 1080

cap = cv2.VideoCapture(f"{W}/cut.mov"); gray = []
while True:
    ok, f = cap.read()
    if not ok: break
    gray.append(cv2.cvtColor(cv2.resize(f, (540, 960)), cv2.COLOR_BGR2GRAY))
N = len(gray)
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
gx, gy = np.meshgrid(np.arange(WD, dtype=np.float32), np.arange(H, dtype=np.float32))

def crop_mask(i):
    """lower-body matte placed in a full-size canvas; odd frames without one are flow-warped from neighbours"""
    p = f"{W}/cmask/m{i:04d}.png"
    def load(k):
        c = np.zeros((H, WD), np.float32); c[Y0:] = cv2.imread(f"{W}/cmask/m{k:04d}.png", 0); return c
    if os.path.exists(p): return load(i)
    have = [k for k in (i - 1, i + 1) if 0 <= k < N and os.path.exists(f"{W}/cmask/m{k:04d}.png")]
    if not have: return None
    acc = 0
    for k in have:
        fl = cv2.resize(dis.calc(gray[i], gray[k], None), (WD, H)) * 2
        acc = acc + cv2.remap(load(k), gx + fl[..., 0], gy + fl[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return acc / len(have)

def ramp(a, b):
    y = np.arange(H, dtype=np.float32)[:, None]
    return np.clip((y - a) / (b - a), 0, 1)

def shift(m, dx, dy):
    return cv2.warpAffine(m, np.float32([[1, 0, dx], [0, 1, dy]]), (WD, H), borderMode=cv2.BORDER_REPLICATE)

g = lambda m, s: cv2.GaussianBlur(m, (0, 0), s)
R_BLEND = ramp(1150, 1300)          # where the high-res lower matte takes over
R_CLEAN = ramp(1350, 1460)          # arms/hands zone: firm, smooth edges
DESK_W = ramp(DESK - 2, DESK + 30)
WALL_W = 1 - ramp(DESK - 10, DESK + 4)
RIM_W = 1 - ramp(1250, 1450)
yy, xx = np.mgrid[0:H, 0:WD].astype(np.float32)
GLOW = np.clip(1 - np.hypot(xx - 540, (yy - 770) * 0.9) / 720, 0, 1) ** 1.3   # warm backlight behind his head

only = [int(a) for a in sys.argv[1:]] or range(N)
for i in only:
    F = cv2.imread(f"{W}/fmask/m{i:04d}.png", 0).astype(np.float32) / 255
    C = crop_mask(i)
    M = F if C is None else F * (1 - R_BLEND) + (C / 255) * R_BLEND
    # arms zone: kill half-transparent leftovers of the old tablecloth, then anti-alias
    firm = np.clip((M - 0.38) / 0.24, 0, 1); firm = firm * firm * (3 - 2 * firm)
    firm = g(firm, 1.1)
    M = M * (1 - R_CLEAN) + firm * R_CLEAN
    cv2.imwrite(f"{W}/mmask/m{i:04d}.png", (M * 255).astype(np.uint8))

    # shadows (dark warm), desk contact + soft, and a soft wall shadow to his left
    ao = g(shift(M, 0, 6), 7); soft = g(shift(M, 6, 26), 30)
    desk = np.clip(0.80 * ao + 0.50 * soft, 0, 0.88) * DESK_W
    wall = g(shift(M, -40, 28), 42) * 0.42 * WALL_W
    a = np.clip(desk + wall, 0, 0.9)
    sh = np.dstack([np.full_like(a, 8), np.full_like(a, 12), np.full_like(a, 20), a * 255]).astype(np.uint8)
    cv2.imwrite(f"{PUB}/sh/s{i:04d}.png", sh, [cv2.IMWRITE_PNG_COMPRESSION, 3])

    # light wrap: thin band just inside his silhouette, lit by the warm glow behind him
    band = np.clip(M - cv2.erode(M, np.ones((11, 11), np.uint8)), 0, 1)
    band = g(band, 3) * M * RIM_W * GLOW
    wr = np.dstack([np.full_like(band, 110), np.full_like(band, 175), np.full_like(band, 255), np.clip(band * 0.45, 0, 1) * 255]).astype(np.uint8)
    cv2.imwrite(f"{PUB}/wr/w{i:04d}.png", wr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
print("layers built:", len(list(only)))
