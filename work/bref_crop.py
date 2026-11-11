# High-res matte of the lower body (arms/hands on the desk): BiRefNet on the crop y 1100..1920 only.
import os, time, numpy as np, cv2, onnxruntime as ort
W = "/home/user/Testvidei/work"; out = f"{W}/cmask"; os.makedirs(out, exist_ok=True)
Y0 = 1100
so = ort.SessionOptions(); so.enable_cpu_mem_arena = False; so.enable_mem_pattern = False; so.intra_op_num_threads = 4
s = ort.InferenceSession("/root/.rembg/models/birefnet-portrait/birefnet-portrait.onnx", so, providers=["CPUExecutionProvider"])
name = s.get_inputs()[0].name
mean = np.array([0.485, 0.456, 0.406], np.float32); std = np.array([0.229, 0.224, 0.225], np.float32)
cap = cv2.VideoCapture(f"{W}/cut.mov"); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f[Y0:])
order = list(range(0, len(frames), 2)) + list(range(1, len(frames), 2))
for i in order:
    p = f"{out}/m{i:04d}.png"
    if os.path.exists(p): continue
    t = time.time(); c = frames[i]; h, w = c.shape[:2]
    x = cv2.resize(cv2.cvtColor(c, cv2.COLOR_BGR2RGB), (1024, 1024), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    x = (x / max(x.max(), 1e-6) - mean) / std
    y = s.run(None, {name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pr = 1 / (1 + np.exp(-y)); pr = (pr - pr.min()) / (pr.max() - pr.min())
    cv2.imwrite(p, cv2.resize((pr * 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_CUBIC))
    print(i, round(time.time() - t, 1), flush=True)
print("done")
