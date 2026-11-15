#!/usr/bin/env bash
# Builds a hibi.app release into dist/ in two stages, so the signing key
# never shares a machine with npm or the web build:
#
#   scripts/release-desktop.sh build 0.1.0   # dmg + unsigned .app.zip (needs npm, Wails; no key)
#   scripts/release-desktop.sh sign  0.1.0   # .sig + latest.json (needs only Go and the key)
#
# CI runs them in separate jobs (.github/workflows/desktop-release.yml); run
# both locally for a dry run. Signing key: $HIBI_UPDATE_PRIVATE_KEY, else
# ~/.config/hibi/update.key. sign fails unless the zip verifies against the
# public key compiled into the app (desktop/update/pubkey.txt).
set -euo pipefail

MODE=${1:-} V=${2:-}
[[ $MODE == build || $MODE == sign ]] || { echo "usage: scripts/release-desktop.sh build|sign x.y.z" >&2; exit 1; }
[[ $V =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must be x.y.z, got '$V'" >&2; exit 1; }
cd "$(dirname "$0")/.."
[ -s desktop/update/pubkey.txt ] || { echo "desktop/update/pubkey.txt is empty" >&2; exit 1; }

REPO=https://github.com/shcherbyakdev/hibi
ZIP=hibi-$V.app.zip

if [[ $MODE == build ]]; then
  if [[ -n ${HIBI_UPDATE_PRIVATE_KEY:-} ]]; then
    echo "refusing to build with HIBI_UPDATE_PRIVATE_KEY set: build runs npm code" >&2
    exit 1
  fi
  APP=desktop/build/bin/hibi.app
  WAILS=${WAILS:-$(command -v wails || echo "$(go env GOPATH)/bin/wails")}

  # The bundle's version comes from wails.json; set it for this build only.
  # (Editing Info.plist after the build would break the bundle's signature.)
  cp desktop/wails.json desktop/wails.json.orig
  trap 'mv desktop/wails.json.orig desktop/wails.json' EXIT
  node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f));j.info.productVersion=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(j,null,2)+"\n")' desktop/wails.json "$V"

  rm -rf dist && mkdir dist
  npm run build:desktop
  find desktop/ui -mindepth 1 ! -name .gitignore -delete
  cp -R out/. desktop/ui/
  (cd desktop && CGO_CFLAGS=-mmacosx-version-min=13.0 CGO_LDFLAGS=-mmacosx-version-min=13.0 \
    "$WAILS" build -platform darwin/universal -clean -ldflags "-X main.version=$V")

  ditto -c -k --keepParent "$APP" "dist/$ZIP"
  STAGE=$(mktemp -d)
  ditto "$APP" "$STAGE/hibi.app"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -quiet -volname hibi -srcfolder "$STAGE" -format UDZO -ov "dist/hibi-$V.dmg"
  rm -rf "$STAGE"
else
  [ -f "dist/$ZIP" ] || { echo "dist/$ZIP is missing: run the build stage first" >&2; exit 1; }
  # hibi-sign is our own code on the Go stdlib only: nothing third-party
  # runs while the key is in reach.
  (cd desktop && go run ./cmd/hibi-sign sign "../dist/$ZIP") > "dist/$ZIP.sig"
  (cd desktop && go run ./cmd/hibi-sign verify "../dist/$ZIP" "../dist/$ZIP.sig")
  # jq-free on purpose: python3 ships on both runners and macOS.
  python3 -I -c 'import json,sys; v,url,sig=sys.argv[1:]; print(json.dumps({"version":v,"url":url,"signature":sig,"notes":""},indent=2))' \
    "$V" "$REPO/releases/download/desktop-v$V/$ZIP" "$(cat "dist/$ZIP.sig")" > dist/latest.json
fi

ls -la dist
