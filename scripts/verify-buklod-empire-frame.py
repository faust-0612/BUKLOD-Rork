"""Reject blank/gray frames, including status and navigation-bar-only screenshots."""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
w,h = im.size
crop = im.crop((int(w*.10),int(h*.13),int(w*.90),int(h*.87))).resize((160,90))
pixels = list(crop.getdata())
colors = len(set(pixels))
colored = sum(max(p)-min(p)>=16 for p in pixels)/len(pixels)
print(f"EMPIRE_FRAME_CHECK colors={colors} colored_fraction={colored:.3f}")
# Real Empire backgrounds, character art and HUD contain extensive color.
if colors < 80 or colored < .12:
    print("EMPIRE_BLANK_OR_GRAYSCALE_FRAME",file=sys.stderr)
    sys.exit(1)
