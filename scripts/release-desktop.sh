#!/usr/bin/env bash
# Builds a hibi.app release into dist/: the dmg, the signed .app.zip (+ .sig)
# and latest.json (the updater's feed). The release workflow runs this, then
# uploads dist/; run it locally for a dry run.
#
#   scripts/release-desktop.sh 0.1.0
#
# Signing key: $HIBI_UPDATE_PRIVATE_KEY (CI secret), else
# ~/.config/hibi/update.key. The script fails unless the zip's signature
# verifies against the public key compiled into the app (update/pubkey.txt).
set -euo pipefail

V=${1:?usage: scripts/release-desktop.sh x.y.z}
[[ $V =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must be x.y.z, got '$V'" >&2; exit 1; }
cd "$(dirname "$0")/.."
[ -s desktop/update/pubkey.txt ] || { echo "desktop/update/pubkey.txt is empty" >&2; exit 1; }

REPO=https://github.com/shcherbyakdev/hibi
ZIP=hibi-$V.app.zip
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
(cd desktop && go run ./cmd/hibi-sign sign "../dist/$ZIP") > "dist/$ZIP.sig"
(cd desktop && go run ./cmd/hibi-sign verify "../dist/$ZIP" "../dist/$ZIP.sig")

STAGE=$(mktemp -d)
ditto "$APP" "$STAGE/hibi.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -quiet -volname hibi -srcfolder "$STAGE" -format UDZO -ov "dist/hibi-$V.dmg"
rm -rf "$STAGE"

node -e 'const [v,url,sig]=process.argv.slice(1);process.stdout.write(JSON.stringify({version:v,url,signature:sig,notes:""},null,2)+"\n")' \
  "$V" "$REPO/releases/download/desktop-v$V/$ZIP" "$(cat "dist/$ZIP.sig")" > dist/latest.json

ls -la dist
