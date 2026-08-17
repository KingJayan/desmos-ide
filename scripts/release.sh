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
# with no SIGN_IDENTITY the app is signed ad hoc and notarization is skipped.
# an ad-hoc signature satisfies the arm64 kernel, but not Gatekeeper, so the
# cask strips the quarantine flag after it copies the app.
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
bun run build

APP="$(find build -maxdepth 3 -name '*.app' -type d | head -1)"
[[ -n "$APP" ]] || die "no .app under build/"
APP_NAME="$(basename "$APP" .app)"
echo "app: ${APP}"

step "installing the quick look extension"
APPEX="dist/quicklook/DsmxQuickLook.appex"
[[ -d "$APPEX" ]] || die "missing ${APPEX} — did build:native run?"
mkdir -p "${APP}/Contents/PlugIns"
rm -rf "${APP}/Contents/PlugIns/DsmxQuickLook.appex"
cp -R "$APPEX" "${APP}/Contents/PlugIns/"

if [[ $ADHOC -eq 1 ]]; then
  step "signing ad hoc"
  # no timestamp and no hardened runtime: both want a real authority
  sign() { codesign --force --timestamp=none --sign - "$@"; }
else
  step "signing"
  sign() {
    codesign --force --timestamp --options runtime \
      --entitlements scripts/entitlements.plist \
      --sign "$SIGN_IDENTITY" "$@"
  }
fi

while IFS= read -r -d '' nested; do
  sign "$nested"
done < <(find "${APP}/Contents" \
  \( -name '*.dylib' -o -name '*.framework' -o -name '*.appex' \) -print0)

while IFS= read -r -d '' candidate; do
  if file -b "$candidate" | grep -q 'Mach-O'; then sign "$candidate"; fi
done < <(find "${APP}/Contents" -type f -perm -u+x -print0)

sign "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

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
