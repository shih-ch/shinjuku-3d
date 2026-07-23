#!/bin/bash
# 檢查 src/livecams.js 內各直播 ID 是否仍在直播中（isLiveNow）。
# 失效時到該條目的 ch 頻道頁找新的直播 ID 更新。
grep -oP "id: '\K[a-zA-Z0-9_-]{11}" "$(dirname "$0")/../src/livecams.js" | while read -r id; do
  live=$(curl -sL --max-time 20 "https://www.youtube.com/watch?v=$id" | grep -o '"isLiveNow":true' | head -1)
  echo "$id ${live:+LIVE}${live:-DEAD}"
  sleep 1
done
