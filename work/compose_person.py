# Build RGBA person frames: cut.mov pixels + matte, with edge colour de-spill
# (removes the old beige wall bleeding into semi-transparent hair/edge pixels).
import sys, os, cv2, numpy as np
maskdir, outdir = sys.argv[1], sys.argv[2]; os.makedirs(outdir, exist_ok=True)
import sys as _s
SRC = _s.argv[3] if len(_s.argv) > 3 else "/home/user/Testvidei/work/cut.mov"
cap = cv2.VideoCapture(SRC); i = 0; n = 0
EDGE = _s.argv[4] if len(_s.argv) > 4 else None          # un-sharpened copy used on the silhouette edge
cap2 = cv2.VideoCapture(EDGE) if EDGE else None
while True:
    ok, f = cap.read()
    if not ok: break
    fe = cap2.read()[1] if cap2 is not None else f
    mp_ = f"{maskdir}/m{i:04d}.png"; op = f"{outdir}/p{i:04d}.png"
    if os.path.exists(mp_) and (not os.path.exists(op) or os.path.getmtime(op) < os.path.getmtime(mp_)):
        a = cv2.imread(mp_, 0).astype(np.float32) / 255
        I = fe.astype(np.float32)
        bgw = (a < 0.05).astype(np.float32)
        B = cv2.GaussianBlur(I * bgw[..., None], (0, 0), 25) / (cv2.GaussianBlur(bgw, (0, 0), 25)[..., None] + 1e-4)
        ac = np.clip(a, 0.02, 1)[..., None]
        F = np.clip((I - (1 - ac) * B) / ac, 0, 255)
        edge = ((a > 0.02) & (a < 0.97))[..., None]
        # edge colour = colour pulled from just inside the silhouette (no old-wall contamination at all)
        win_ = (a > 0.97).astype(np.float32)
        Cin = cv2.GaussianBlur(I * win_[..., None], (0, 0), 4) / (cv2.GaussianBlur(win_, (0, 0), 4)[..., None] + 1e-4)
        Cin = np.where(cv2.GaussianBlur(win_, (0, 0), 4)[..., None] > 1e-3, Cin, F)
        col = np.where(edge, Cin, I)
        # sharpened pixels only well inside the silhouette (no dark halo on the edge)
        wi = cv2.GaussianBlur(cv2.erode((a > 0.95).astype(np.float32), np.ones((9, 9), np.uint8)), (0, 0), 3)[..., None]
        col = f.astype(np.float32) * wi + col * (1 - wi)
        cv2.imwrite(op, np.dstack([col, a * 255]).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 2]); n += 1
    i += 1
print("person frames written:", n)
