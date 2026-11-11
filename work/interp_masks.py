# Fill frames that have no high-quality matte by warping the neighbouring mattes with optical flow.
import os, cv2, numpy as np
W = "/home/user/Testvidei/work"
cap = cv2.VideoCapture(f"{W}/cut.mov"); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(cv2.cvtColor(cv2.resize(f, (540, 960)), cv2.COLOR_BGR2GRAY))
N = len(fr); os.makedirs(f"{W}/fmask", exist_ok=True)
have = {i for i in range(N) if os.path.exists(f"{W}/mask/m{i:04d}.png")}
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
def warp(src_i, dst_i):
    fl = dis.calc(fr[dst_i], fr[src_i], None)            # for each dst pixel, where it is in src
    fl = cv2.resize(fl, (1080, 1920)) * 2
    gx, gy = np.meshgrid(np.arange(1080, dtype=np.float32), np.arange(1920, dtype=np.float32))
    m = cv2.imread(f"{W}/mask/m{src_i:04d}.png", 0)
    return cv2.remap(m, gx + fl[..., 0], gy + fl[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
made = 0
for i in range(N):
    out = f"{W}/fmask/m{i:04d}.png"
    if i in have:
        if not os.path.exists(out) or os.path.islink(out) is False and os.path.getmtime(out) < os.path.getmtime(f"{W}/mask/m{i:04d}.png"):
            cv2.imwrite(out, cv2.imread(f"{W}/mask/m{i:04d}.png", 0))
        continue
    p = max([k for k in have if k < i], default=None); n = min([k for k in have if k > i], default=None)
    if p is None and n is None: continue
    if p is None: m = warp(n, i)
    elif n is None: m = warp(p, i)
    else:
        wp = (n - i) / (n - p)
        m = wp * warp(p, i) + (1 - wp) * warp(n, i)
    cv2.imwrite(out, np.clip(m, 0, 255).astype(np.uint8)); made += 1
print("real:", len(have), "interpolated:", made)
