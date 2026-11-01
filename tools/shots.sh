#!/usr/bin/env bash
# 对照图组：固定机位 × 固定时刻，出 3×3 张 + 一张联络表。
# 用途：每一轮美术/工程改动前后各跑一次，用同一组参数出图，肉眼或像素差对比。
# 用法: ./tools/shots.sh [输出目录] [单张宽] [单张高]
#   SHOT_BASE=http://127.0.0.1:8080/index.html ./tools/shots.sh tools/base-http
#   不设 SHOT_BASE 时走 file://（离线兜底，牛是预烘版本）
# 注意：必须用真实 GPU 后端（不要加 --use-angle=swiftshader），SwiftShader 会
#      把着色器里的 NaN 画成透明，掩盖黑块类 bug；且每次换新 profile 目录，
#      否则 Chrome 会缓存脚本，改代码不生效。
set -e
cd "$(dirname "$0")/.."
OUT=${1:-tools/base}
W=${2:-960}
H=${3:-540}
VIEWS="overview gate barn"
HOURS="12 18.3 21.5"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE=${SHOT_BASE:-"file:///$(pwd -W)/index.html"}
mkdir -p "$OUT"

for v in $VIEWS; do
  for h in $HOURS; do
    P="$OUT/.p_${v}_${h}"
    rm -rf "$P"
    "$CHROME" --headless=new --disable-breakpad --disable-crash-reporter \
      --hide-scrollbars --no-first-run --disk-cache-size=1 \
      --window-size="$W,$H" --force-device-scale-factor=1 --virtual-time-budget=32000 \
      --user-data-dir="$(pwd -W)/$P" \
      --screenshot="$(pwd -W)/$OUT/${v}_${h}.png" \
      "${BASE}?cam=$v&hour=$h&ui=0&t=40&r=$(date +%s%N)" >/dev/null 2>&1
    rm -rf "$P"
    echo "  ok $v @ $h"
  done
done

python tools/sheet.py "$OUT" "$VIEWS" "$HOURS"
