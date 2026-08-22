#!/usr/bin/env bash
#
# runs electrobun's own installer, then registers the .dsmx file type and
# the dsmx:// scheme, which electrobun does not do on its own.
#
#   packaging/linux/install.sh [~/Applications/desmos-ide-Setup/installer]

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

INSTALLER="${1:-}"
if [[ -z "$INSTALLER" ]]; then
  INSTALLER="${HERE}/installer"
fi
[[ -f "$INSTALLER" ]] || { echo "usage: install.sh <path to the installer>" >&2; exit 1; }
chmod +x "$INSTALLER"

for lib in libgtk-3.so.0 libwebkit2gtk-4.1.so.0; do
  ldconfig -p 2>/dev/null | grep -q "$lib" \
    || echo "install: ${lib} is not installed. the app cannot start without it — see the README" >&2
done

echo "running electrobun's installer..."
"$INSTALLER"

IDENTIFIER="dev.desmoside.app"
CHANNEL="stable"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
LAUNCHER="${DATA}/${IDENTIFIER}/${CHANNEL}/app/bin/launcher"
[[ -f "$LAUNCHER" ]] || { echo "install: electrobun's installer did not create ${LAUNCHER}" >&2; exit 1; }

ICON="${HERE}/dsmx.svg"
[[ -f "$ICON" ]] || ICON="${HERE}/../../docs/static/favicon-scalable.svg"

mkdir -p "${DATA}/applications" "${DATA}/mime/packages" "${DATA}/icons/hicolor/scalable/apps"

sed "s|@EXEC@|${LAUNCHER}|" "${HERE}/dsmx.desktop" > "${DATA}/applications/dsmx.desktop"
cp "${HERE}/dsmx.xml" "${DATA}/mime/packages/dsmx.xml"
cp "$ICON" "${DATA}/icons/hicolor/scalable/apps/dsmx.svg"

update-mime-database "${DATA}/mime" 2>/dev/null || true
update-desktop-database "${DATA}/applications" 2>/dev/null || true
xdg-mime default dsmx.desktop application/x-dsmx 2>/dev/null || true
xdg-mime default dsmx.desktop x-scheme-handler/dsmx 2>/dev/null || true

echo "installed: ${DATA}/applications/dsmx.desktop"
