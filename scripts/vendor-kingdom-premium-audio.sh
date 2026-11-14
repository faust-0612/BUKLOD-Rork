#!/usr/bin/env bash
# Offline, exact-blob-verified CC0 Kingdom music and SFX vendor.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="assets/sounds/kingdom-premium"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
while IFS='|' read -r filename sha url expected_size; do
  [ -n "$filename" ] || continue
  case "$filename" in *..*|*/*) echo "Unsafe filename: $filename" >&2; exit 1 ;; esac
  curl --proto '=https' --tlsv1.2 --fail --location --silent --show-error \
    --retry 3 --retry-delay 2 --connect-timeout 10 --max-time 90 "$url" -o "$TMP/$filename"
  actual_sha="$(git hash-object "$TMP/$filename")"
  actual_size="$(wc -c < "$TMP/$filename" | tr -d ' ')"
  if [ "$actual_sha" != "$sha" ] || [ "$actual_size" != "$expected_size" ]; then
    echo "Hash/size mismatch: $filename ($actual_sha, $actual_size)" >&2
    exit 1
  fi
  mv "$TMP/$filename" "$OUT/$filename"
  echo "Verified $filename ($actual_size bytes)"
done <<'ASSETS'
kingdom-theme.ogg|fa90c432d910997dd3089f8690c45b628d45952a|https://raw.githubusercontent.com/arianne/stendhal/95f3971e9974d74b3e2cb4ad877400309fb1284e/app/android/client/src/main/res/raw/title_01.ogg|713677
kingdom-village.ogg|cf0f94ee0562f33b16856b3d1e160eab90d58ce6|https://raw.githubusercontent.com/arianne/stendhal/95f3971e9974d74b3e2cb4ad877400309fb1284e/app/android/client/src/main/res/raw/title_04.ogg|503696
kingdom-great-hall.ogg|678fd116fa338303b3aae091bc29fb81b30e433d|https://raw.githubusercontent.com/arianne/stendhal/95f3971e9974d74b3e2cb4ad877400309fb1284e/app/android/client/src/main/res/raw/title_05.ogg|578141
ui-soft.wav|9276c9b268ae96f6473ce7035432bb3aaa78eb37|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/click_003.wav|1742
collect-crystal.wav|1babf78e6f0a5f117d9475b2068739e7fb62e0c8|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/glass_001.wav|25806
impact-wood.wav|b7a42211c3f815080e20e3012b135131dfb7c8ea|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/drop_003.wav|35150
victory.wav|4aa7f6599f0b3291308dc23b39eb555a85dee478|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/confirmation_004.wav|44238
failure.wav|edcf344ee212d13797f250eb5649ce55c655d825|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/error_001.wav|30542
unlock.wav|61b63c1b404734114bcf872cd1b4e1a2004dacb0|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/maximize_005.wav|46670
enter.wav|5195040c3313a9dabb165351aea0254341ad8739d|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/open_003.wav|27982
coins.wav|45a517f9d968137d1ae50a6eb50b7258a2ceb64b|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/pluck_001.wav|19790
victory-alt.wav|2ef68f15c22d9966081f923c53926f1b464b7fc|https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/confirmation_002.wav|49614
ASSETS
