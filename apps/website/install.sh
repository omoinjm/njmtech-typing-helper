#!/bin/bash
# Typing Helper installer for macOS and Linux.
#
#   curl -fsSL https://typing.njmtech.co.za/install.sh | bash
#
# Downloads the latest GitHub Release and extracts the Chrome (also Brave /
# Opera), Edge and Firefox builds to ~/typing-helper/<browser>. Re-running
# replaces those folders in place, so an update is just "Reload" on the
# browser's extensions page. Sticks to bash 3.2 and tools macOS ships with
# (curl, unzip) — no jq or python needed.

# Everything lives in main() so a truncated `curl | bash` download never runs
# half a script.
main() {
    set -u
    local repo='omoinjm/njmtech-typing-helper'
    local root="$HOME/typing-helper"
    local api="https://api.github.com/repos/$repo/releases/latest"
    local json tag installed='' browser url zip staging target

    # macOS always has unzip; minimal Linux installs often don't.
    if ! command -v unzip >/dev/null 2>&1; then
        echo "unzip is required. Install it first (e.g. sudo apt install unzip, sudo dnf install unzip)." >&2
        return 1
    fi

    if ! json=$(curl -fsSL -H 'Accept: application/vnd.github+json' -H 'User-Agent: typing-helper-installer' "$api"); then
        echo "Could not fetch the latest release from GitHub." >&2
        return 1
    fi
    tag=$(printf '%s' "$json" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)

    echo "Installing Typing Helper $tag to $root"
    mkdir -p "$root" || return 1

    for browser in chrome edge firefox; do
        url=$(printf '%s' "$json" | sed -n "s/.*\"browser_download_url\": *\"\([^\"]*-$browser\.zip\)\".*/\1/p" | head -n 1)
        if [ -z "$url" ]; then
            echo "  $browser : no asset in $tag, skipped"
            continue
        fi

        zip="${TMPDIR:-/tmp}/${url##*/}"
        staging="$root/.staging-$browser"
        target="$root/$browser"
        echo "  $browser : downloading ${url##*/}"
        rm -rf "$staging"
        # Swap only after a successful extraction, so a failed run keeps the
        # previous install intact.
        if curl -fsSL -o "$zip" "$url" && unzip -q -o "$zip" -d "$staging"; then
            rm -rf "$target" && mv "$staging" "$target"
            installed="$installed $browser"
            echo "  $browser : installed to $target"
        else
            echo "  $browser : failed" >&2
            rm -rf "$staging"
        fi
        rm -f "$zip"
    done

    if [ -z "$installed" ]; then
        echo "Nothing was installed." >&2
        return 1
    fi
    printf '%s\n' "$tag" > "$root/VERSION"

    echo
    echo "Typing Helper $tag is ready. Load it in your browser:"
    case "$installed" in *chrome*)
        echo "  Chrome / Brave / Opera: chrome://extensions (brave://, opera://) -> Developer mode -> Load unpacked ->"
        echo "    $root/chrome" ;;
    esac
    case "$installed" in *edge*)
        echo "  Edge: edge://extensions -> Developer mode -> Load unpacked ->"
        echo "    $root/edge" ;;
    esac
    case "$installed" in *firefox*)
        echo "  Firefox: about:debugging#/runtime/this-firefox -> Load Temporary Add-on ->"
        echo "    $root/firefox/manifest.json  (removed when Firefox closes)" ;;
    esac
    echo
    if [ "$(uname -s)" = Darwin ]; then
        echo "Tip: in the folder picker, press Cmd+Shift+G and paste the path."
    else
        echo "Tip: in the folder picker, press Ctrl+L and paste the path."
    fi
    echo "Already loaded? Just click Reload on the extension card to pick up the update."
}

main "$@"
