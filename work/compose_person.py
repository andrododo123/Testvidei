# Build RGBA person frames: cut.mov pixels + matte, with edge colour de-spill
# (removes the old beige wall bleeding into semi-transparent hair/edge pixels).
import sys, os, cv2, numpy as np
maskdir, outdir = sys.argv[1], sys.argv[2]; os.makedirs(outdir, exist_ok=True)
cap = cv2.VideoCapture("/home/user/Testvidei/work/cut.mov"); i = 0; n = 0
while True:
    ok, f = cap.read()
    if not ok: break
    mp_ = f"{maskdir}/m{i:04d}.png"; op = f"{outdir}/p{i:04d}.png"
    if os.path.exists(mp_) and (not os.path.exists(op) or os.path.getmtime(op) < os.path.getmtime(mp_)):
        a = cv2.imread(mp_, 0).astype(np.float32) / 255
        I = f.astype(np.float32)
        bgw = (a < 0.05).astype(np.float32)
        B = cv2.GaussianBlur(I * bgw[..., None], (0, 0), 25) / (cv2.GaussianBlur(bgw, (0, 0), 25)[..., None] + 1e-4)
        ac = np.clip(a, 0.02, 1)[..., None]
        F = np.clip((I - (1 - ac) * B) / ac, 0, 255)
        edge = ((a > 0.02) & (a < 0.97))[..., None]
        col = np.where(edge, F, I)
        cv2.imwrite(op, np.dstack([col, a * 255]).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 2]); n += 1
    i += 1
print("person frames written:", n)
