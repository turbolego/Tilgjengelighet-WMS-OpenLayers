#!/usr/bin/env python3
"""Generate a release notes markdown table from artifact files."""
import sys, os, glob

tag = sys.argv[1]
sha = sys.argv[2]
artifacts_dir = sys.argv[3]

lines = [
    f"## 📱 Geonorge Tilgjengelighet — {tag}",
    "",
    "| Platform | File | Description |",
    "|----------|------|-------------|",
]

for f in sorted(glob.glob(f"{artifacts_dir}/**/*", recursive=True)):
    if not os.path.isfile(f):
        continue
    fname = os.path.basename(f)
    plat = "Android" if "android" in f.lower() else "iOS"
    ext = fname.rsplit(".", 1)[-1].lower()
    desc = {
        "aab": "Play Store-bundle",
        "apk": "Direct install",
    }.get(ext, "App")
    lines.append(f"| {plat} | `{fname}` | {desc} |")

lines += [
    "",
    "### Installation",
    "- **Android**: Download the APK and install directly on device",
    "- **AAB** (Play Store bundle): Uploaded automatically by the AAB workflow once its build completes",
    "- **iOS**: Requires a Mac with Xcode to install on simulator or device",
    "",
    f"> Built from commit `{sha[:7]}`",
]

print("\n".join(lines))