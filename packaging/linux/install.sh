#!/usr/bin/env bash
#
# registers the AppImage with the desktop: the launcher entry, the .dsmx file
# type and the dsmx:// scheme. electrobun writes none of these.
#
#   packaging/linux/install.sh ~/Applications/desmos-ide-Setup.AppImage

set -euo pipefail

APPIMAGE="${1:-}"
[[ -n "$APPIMAGE" ]] || { echo "usage: install.sh <path to the .AppImage>" >&2; exit 1; }
[[ -f "$APPIMAGE" ]] || { echo "install: no file at ${APPIMAGE}" >&2; exit 1; }
APPIMAGE="$(cd "$(dirname "$APPIMAGE")" && pwd)/$(basename "$APPIMAGE")"
chmod +x "$APPIMAGE"

HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"

for lib in libgtk-3.so.0 libwebkit2gtk-4.1.so.0; do
  ldconfig -p 2>/dev/null | grep -q "$lib" \
    || echo "install: ${lib} is not installed. the app cannot start without it — see the README" >&2
done

mkdir -p "${DATA}/applications" "${DATA}/mime/packages" "${DATA}/icons/hicolor/scalable/apps"

sed "s|@EXEC@|${APPIMAGE}|" "${HERE}/dsmx.desktop" > "${DATA}/applications/dsmx.desktop"
cp "${HERE}/dsmx.xml" "${DATA}/mime/packages/dsmx.xml"
cp "${HERE}/../../docs/static/favicon-scalable.svg" "${DATA}/icons/hicolor/scalable/apps/dsmx.svg"

update-mime-database "${DATA}/mime" 2>/dev/null || true
update-desktop-database "${DATA}/applications" 2>/dev/null || true
xdg-mime default dsmx.desktop application/x-dsmx 2>/dev/null || true
xdg-mime default dsmx.desktop x-scheme-handler/dsmx 2>/dev/null || true

echo "installed: ${DATA}/applications/dsmx.desktop"
