#!/bin/bash

# Installation script for Open in GitHub extension
# This script installs the extension to Cursor and VSCode extension directories

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="https://github.com/jloleysens/open-in-github"
EXTENSION_NAME="open-in-github"
CURSOR_EXTENSIONS_DIR="$HOME/.cursor/extensions"
VSCODE_EXTENSIONS_DIR="$HOME/.vscode/extensions"
TMP_DIR="/tmp/${EXTENSION_NAME}-install"

echo -e "${GREEN}Installing Open in GitHub extension for Cursor and VSCode...${NC}"

SOURCE_DIR=""
SCRIPT_SOURCE="${BASH_SOURCE[0]}"

if [ -f "$SCRIPT_SOURCE" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
    if [ -f "$SCRIPT_DIR/package.json" ] && [ -f "$SCRIPT_DIR/extension.js" ]; then
        SOURCE_DIR="$SCRIPT_DIR"
        echo "Installing from local checkout: $SOURCE_DIR"
    fi
fi

if [ -z "$SOURCE_DIR" ]; then
    # Create temporary directory
    echo "Creating temporary directory..."
    rm -rf "$TMP_DIR"
    mkdir -p "$TMP_DIR"

    # Download the repository
    echo "Downloading extension from GitHub..."
    cd "$TMP_DIR"

    # Try to download as zip
    if command -v curl &> /dev/null; then
        curl -L "${GITHUB_REPO}/archive/refs/heads/main.zip" -o repo.zip
    elif command -v wget &> /dev/null; then
        wget "${GITHUB_REPO}/archive/refs/heads/main.zip" -O repo.zip
    else
        echo -e "${RED}Error: Neither curl nor wget is available. Please install one of them.${NC}"
        exit 1
    fi

    # Unzip the repository
    echo "Extracting files..."
    if command -v unzip &> /dev/null; then
        unzip -q repo.zip
    else
        echo -e "${RED}Error: unzip command not found. Please install unzip.${NC}"
        exit 1
    fi

    # Find the extracted directory (it will be named something like open-in-github-main)
    SOURCE_DIR=$(find . -maxdepth 1 -type d -name "${EXTENSION_NAME}-*" | head -n 1)

    if [ -z "$SOURCE_DIR" ]; then
        echo -e "${RED}Error: Could not find extracted directory${NC}"
        exit 1
    fi
fi

install_extension() {
    local editor_name="$1"
    local extensions_dir="$2"
    local target_dir="$extensions_dir/$EXTENSION_NAME"

    echo "Creating ${editor_name} extensions directory..."
    mkdir -p "$extensions_dir"

    if [ -d "$target_dir" ]; then
        echo "Removing old ${editor_name} version..."
        rm -rf "$target_dir"
    fi

    echo "Installing extension for ${editor_name}..."
    cp -R "$SOURCE_DIR" "$target_dir"
    rm -rf "$target_dir/.git" "$target_dir/node_modules"

    echo "Installing dependencies for ${editor_name}..."
    if command -v npm &> /dev/null; then
        (cd "$target_dir" && npm install --production --silent)
    else
        echo -e "${YELLOW}Warning: npm not found. Dependencies not installed for ${editor_name}.${NC}"
        echo -e "${YELLOW}Please run 'npm install' in $target_dir${NC}"
    fi
}

install_extension "Cursor" "$CURSOR_EXTENSIONS_DIR"
install_extension "VSCode" "$VSCODE_EXTENSIONS_DIR"

# Clean up
if [ -d "$TMP_DIR" ]; then
    echo "Cleaning up..."
    rm -rf "$TMP_DIR"
fi

echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo "Extension installed to:"
echo "- Cursor: $CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME"
echo "- VSCode: $VSCODE_EXTENSIONS_DIR/$EXTENSION_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart Cursor and VSCode"
echo "2. The extension should be automatically loaded in both editors"
echo "3. Use Cmd+Shift+G (Mac) or Ctrl+Shift+G to open files in GitHub"
echo ""
echo "To configure the extension:"
echo "- Open Cursor or VSCode Settings"
echo "- Search for 'Open in GitHub'"
echo "- Set your repository URL and preferences"
