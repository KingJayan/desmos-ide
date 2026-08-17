#!/usr/bin/env bash
#
# builds, signs, notarizes and publishes a macOS release
#
#   SIGN_IDENTITY="Developer ID Application: Name (TEAMID)" \
#   NOTARY_PROFILE=desmos-ide \
#   scripts/release.sh
#
# NOTARY_PROFILE is a keychain profile made once with:
#   xcrun notarytool store-credentials desmos-ide \
#     --apple-id <id> --team-id <team> --password <app-specific-password>
#
# with no SIGN_IDENTITY the nested binaries are signed ad hoc and notarization is
# skipped. the app bundle itself is left unsigned, because any signature on it
# stops the electrobun launcher before it spawns bun. an ad-hoc signature does
# not satisfy Gatekeeper anyway, so the cask strips the quarantine flag.
#
# pass --dry-run to build and sign without notarizing or publishing.

set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

die() { echo "release: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

[[ "$(uname)" == "Darwin" ]] || die "macOS only"
command -v gh >/dev/null || die "gh is not installed"
ADHOC=0
if [[ -z "${SIGN_IDENTITY:-}" ]]; then
  ADHOC=1
  echo "release: no SIGN_IDENTITY — signing ad hoc, no notarization"
elif [[ $DRY_RUN -eq 0 ]]; then
  [[ -n "${NOTARY_PROFILE:-}" ]] || die "set NOTARY_PROFILE, or pass --dry-run"
fi

[[ -z "$(git status --porcelain)" ]] || die "working tree is dirty"

VERSION="$(bun --print 'require("./package.json").version')"
TAG="v${VERSION}"
git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null && die "tag ${TAG} already exists"

step "building ${TAG}"
rm -rf build/stable-*
bun run build:release

APP="$(find build/stable-* -maxdepth 2 -name '*.app' -type d 2>/dev/null | head -1)"
[[ -n "$APP" ]] || die "no .app under build/stable-* — did electrobun build --env=stable run?"
APP_NAME="$(basename "$APP" .app)"
[[ "$APP" == build/stable-* ]] || die "refusing to touch ${APP}"

PAYLOAD="$(find "${APP}/Contents/Resources" -maxdepth 1 -name '*.tar.zst' | head -1)"
if [[ -n "$PAYLOAD" ]]; then
  step "unpacking the app bundle"
  UNPACKED="build/stable-unpacked"
  rm -rf "$UNPACKED"
  mkdir -p "$UNPACKED"
  tar -xf "$PAYLOAD" -C "$UNPACKED"
  INNER="$(find "$UNPACKED" -maxdepth 1 -name '*.app' -type d | head -1)"
  [[ -n "$INNER" ]] || die "the self-extractor carries no .app"
  rm -rf "$APP"
  mv "$INNER" "$APP"
  rm -rf "$UNPACKED"
fi
echo "app: ${APP}"

step "installing the quick look extension"
APPEX="dist/quicklook/DsmxQuickLook.appex"
[[ -d "$APPEX" ]] || die "missing ${APPEX} — did build:native run?"
mkdir -p "${APP}/Contents/PlugIns"
rm -rf "${APP}/Contents/PlugIns/DsmxQuickLook.appex"
cp -R "$APPEX" "${APP}/Contents/PlugIns/"

if [[ $ADHOC -eq 1 ]]; then
  step "signing ad hoc"
  sign() { codesign --force --timestamp=none --sign - "$@"; }
else
  step "signing"
  sign() {
    codesign --force --timestamp --options runtime \
      --entitlements scripts/entitlements.plist \
      --sign "$SIGN_IDENTITY" "$@"
  }
fi

main_executable() { plutil -extract CFBundleExecutable raw -o - "$1/Contents/Info.plist"; }

APPEX_DEST="${APP}/Contents/PlugIns/DsmxQuickLook.appex"

sign_inside() {
  local bundle="$1" main
  main="$(main_executable "$bundle")"
  while IFS= read -r -d '' candidate; do
    [[ "$(basename "$candidate")" == "$main" ]] && continue
    file -b "$candidate" | grep -q 'Mach-O' || continue
    sign "$candidate"
  done < <(find "${bundle}/Contents" -path "${APPEX_DEST}" -prune -o \
    -type f \( -perm -u+x -o -name '*.dylib' \) -print0)
}

sign_inside "$APPEX_DEST"
sign "$APPEX_DEST"
sign_inside "$APP"

if [[ $ADHOC -eq 1 ]]; then
  codesign --verify --strict --verbose=2 "$APPEX_DEST"
else
  sign "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP"
fi

ZIP="build/${APP_NAME}-${VERSION}-$(uname -m).zip"
step "packing ${ZIP}"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

if [[ $DRY_RUN -eq 1 ]]; then
  step "dry run: stopping before notarization"
  bun run scripts/build-cli.ts
  shasum -a 256 "$ZIP"
  exit 0
fi

if [[ $ADHOC -eq 0 ]]; then
  step "notarizing"
  xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait

  step "stapling"
  xcrun stapler staple "$APP"
  spctl --assess --type execute --verbose=2 "$APP"

  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
fi

step "packing the cli"
bun run scripts/build-cli.ts
CLI_TGZ="build/dsmx-${VERSION}.tar.gz"
rm -f "$CLI_TGZ"
bun run scripts/pack-cli.ts

step "publishing ${TAG}"
git tag -a "$TAG" -m "$TAG"
git push origin "$TAG"
gh release create "$TAG" "$ZIP" "$CLI_TGZ" --title "$TAG" --generate-notes

echo
shasum -a 256 "$ZIP"
