#!/usr/bin/env bash
# ============================================================================
#   TENSA ZANGETSU: SOUL ALTAR DEFENSE - macOS / Linux Launcher
# ============================================================================

cd "$(dirname "$0")"

echo "========================================================"
echo "  TENSA ZANGETSU: SOUL ALTAR DEFENSE"
echo "  Desktop Web Arcade Game (macOS / Linux)"
echo "========================================================"
echo ""

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js detected. Starting local server..."
    if command -v open >/dev/null 2>&1; then
        # macOS: open URL in default browser
        open "http://localhost:8080/"
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux: open URL in default browser
        xdg-open "http://localhost:8080/"
    fi
    node server.js
else
    echo "[INFO] Node.js not found in PATH."
    echo "[OK] Opening index.html directly in your default browser..."
    if command -v open >/dev/null 2>&1; then
        open "index.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "index.html"
    fi
fi
