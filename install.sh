#!/bin/bash

# Installation script for Open in GitHub extension
# This script downloads and installs the extension to Cursor's extensions directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="https://github.com/yourusername/open-in-github"  # Update this with your actual repo URL
EXTENSION_NAME="open-in-github"
CURSOR_EXTENSIONS_DIR="$HOME/.cursor/extensions"
TMP_DIR="/tmp/${EXTENSION_NAME}-install"

echo -e "${GREEN}Installing Open in GitHub extension for Cursor...${NC}"

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
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "${EXTENSION_NAME}-*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo -e "${RED}Error: Could not find extracted directory${NC}"
    exit 1
fi

# Create Cursor extensions directory if it doesn't exist
echo "Creating Cursor extensions directory..."
mkdir -p "$CURSOR_EXTENSIONS_DIR"

# Remove old version if it exists
if [ -d "$CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME" ]; then
    echo "Removing old version..."
    rm -rf "$CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME"
fi

# Move extension to Cursor extensions directory
echo "Installing extension..."
mv "$EXTRACTED_DIR" "$CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME"

# Install dependencies
echo "Installing dependencies..."
cd "$CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME"
if command -v npm &> /dev/null; then
    npm install --production --silent
else
    echo -e "${YELLOW}Warning: npm not found. Dependencies not installed.${NC}"
    echo -e "${YELLOW}Please run 'npm install' in $CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME${NC}"
fi

# Clean up
echo "Cleaning up..."
rm -rf "$TMP_DIR"

echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo "Extension installed to: $CURSOR_EXTENSIONS_DIR/$EXTENSION_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart Cursor"
echo "2. The extension should be automatically loaded"
echo "3. Use Cmd+Shift+G (Mac) or Ctrl+Shift+G to open files in GitHub"
echo ""
echo "To configure the extension:"
echo "- Open Cursor Settings"
echo "- Search for 'Open in GitHub'"
echo "- Set your repository URL and preferences"
