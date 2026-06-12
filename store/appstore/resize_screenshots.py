"""Resize iPhone/iPad screenshots to legacy-compatible App Store slot sizes."""
import os
from PIL import Image

BASE = "C:/Users/Startklaar/Documents/kredyt-ai/store/appstore"

JOBS = [
    {
        "src_dir": f"{BASE}/screenshots-iphone-67",
        "dst_dir": f"{BASE}/screenshots-iphone-65",
        "size": (1284, 2778),
        "files": ["01-raport.png", "02-upload.png", "03-recovery.png", "04-explain.png", "05-chat.png"],
    },
    {
        "src_dir": f"{BASE}/screenshots-iphone-67",
        "dst_dir": f"{BASE}/screenshots-iphone-65-alt",
        "size": (1242, 2688),
        "files": ["01-raport.png", "02-upload.png", "03-recovery.png", "04-explain.png", "05-chat.png"],
    },
    {
        "src_dir": f"{BASE}/screenshots-ipad-13",
        "dst_dir": f"{BASE}/screenshots-ipad-129",
        "size": (2048, 2732),
        "files": ["01-raport.png", "02-upload.png", "03-recovery.png", "04-explain.png"],
    },
]

errors = []
created_counts = {}

for job in JOBS:
    os.makedirs(job["dst_dir"], exist_ok=True)
    folder_name = os.path.basename(job["dst_dir"])
    created_counts[folder_name] = 0
    for fn in job["files"]:
        src = os.path.join(job["src_dir"], fn)
        dst = os.path.join(job["dst_dir"], fn)
        try:
            if not os.path.exists(src):
                errors.append(f"MISSING SOURCE: {src}")
                continue
            with Image.open(src) as img:
                resized = img.resize(job["size"], Image.Resampling.LANCZOS)
                resized.save(dst, format="PNG", optimize=True)
            created_counts[folder_name] += 1
        except Exception as e:
            errors.append(f"ERROR resizing {src} -> {dst}: {e}")

# VERIFY
print("=== VERIFICATION ===")
verified_lines = []
for job in JOBS:
    folder_name = os.path.basename(job["dst_dir"])
    expected = job["size"]
    for fn in job["files"]:
        dst = os.path.join(job["dst_dir"], fn)
        if not os.path.exists(dst):
            line = f"MISSING OUTPUT: {dst}"
            errors.append(line)
            print(line)
            continue
        with Image.open(dst) as img:
            w, h = img.size
        match = "OK" if (w, h) == expected else "MISMATCH"
        line = f"{dst} -> {w}x{h} (expected {expected[0]}x{expected[1]}) [{match}]"
        verified_lines.append(line)
        print(line)
        if (w, h) != expected:
            errors.append(line)

print()
print("=== COUNTS ===")
for k, v in created_counts.items():
    print(f"{k}: {v}")

print()
print("=== ERRORS ===")
if errors:
    for e in errors:
        print(e)
else:
    print("none")
