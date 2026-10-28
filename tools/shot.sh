#!/usr/bin/env bash
# 无头截图：./tools/shot.sh [时间秒] [宽] [高]
# 注意：用真实 GPU 后端（不要加 --use-angle=swiftshader），SwiftShader 会把着色器里的 NaN 画成透明，掩盖黑块类 bug。
# 说明：每次都换一个全新 profile 目录，否则 Chrome 会缓存 file:// 的 JS，改代码不生效。
set -e
cd "$(dirname "$0")/.."
T=${1:-52}
W=${2:-1920}
H=${3:-1080}
OUT=${4:-tools/shot.png}
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
P="tools/profiles/s_$$"

rm -f "$OUT"
"$CHROME" --headless=new --disable-breakpad --disable-crash-reporter \
\
  --hide-scrollbars --no-first-run --disk-cache-size=1 \
  --window-size="$W,$H" --force-device-scale-factor=1 --virtual-time-budget=14000 \
  --user-data-dir="$(pwd -W)/$P" \
  --screenshot="$(pwd -W)/$OUT" \
  "file:///$(pwd -W)/index.html?t=$T&r=$(date +%s)" 2>&1 | tail -1
rm -rf "$P"
