import numpy as np, subprocess, wave, json
SR = 48000
raw = subprocess.run(["ffmpeg","-v","error","-i","cut.mov","-vn","-f","f32le","-ac","2","-ar",str(SR),"-"],capture_output=True).stdout
v = np.frombuffer(raw, np.float32).reshape(-1,2).copy()
n = len(v); out = np.zeros_like(v)
rms = np.sqrt(np.mean(v[np.abs(v).max(1) > 0.01]**2))
peak = rms * 10**(6.5/20)                      # rule: sfx peak ≈ +6.5 dB above voice RMS
rng = np.random.default_rng(3)
def put(t, sig, pan=0.0):
    i = int(t*SR); s = sig/np.abs(sig).max()*peak; e = min(n, i+len(s))
    out[i:e,0] += s[:e-i]*(1-max(0,pan)); out[i:e,1] += s[:e-i]*(1+min(0,pan))
tt = lambda d: np.arange(int(d*SR))/SR
# 1) hook slam: sub thump + soft transient
d = tt(0.45); f = 110*np.exp(-d*7)+38; thump = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-d*7)
click = rng.standard_normal(len(d))*np.exp(-d*120)*0.35
put(0.16, thump+click)
# 2) autofocus lock: classic double beep
b = tt(0.055); beep = np.sin(2*np.pi*2200*b)*np.hanning(len(b))
put(1.95, np.concatenate([beep, np.zeros(int(0.05*SR)), beep])*0.55)
# 3) glitch on the jump cut: chopped, bit-crushed noise + buzz
d = tt(0.26); buzz = np.sign(np.sin(2*np.pi*95*d))*0.5 + rng.standard_normal(len(d))*0.6
gate = (np.floor(d*38) % 3 != 1).astype(float); crushed = np.round(buzz*6)/6
put(5.17, crushed*gate*np.exp(-d*4)*0.8)
mix = v + out
print("voice rms", round(float(20*np.log10(rms)),1), "dBFS; peak", round(float(20*np.log10(np.abs(mix).max())),1))
mix = np.clip(mix, -1, 1)
with wave.open("mg/public/mix.wav","wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())
json.dump({"sfx":[{"t":0.16,"what":"hook slam"},{"t":1.95,"what":"AF lock beep"},{"t":5.17,"what":"glitch on cut"}]}, open("sfx.json","w"))
