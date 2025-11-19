# Open in GitHub Extension

A simple VS Code extension that allows you to quickly open the current file in the upstream GitHub repository.

> [!IMPORTANT]
> This extension is not published to VSCode marketplace or anywhere else. It has no automated tests and it was generated using Claude Code. Use at your own risk.

## Features

- **Open File in GitHub**: Opens the current file in GitHub at the current branch/commit
- **Open File at Line**: Opens the current file in GitHub at the current cursor line
- **Open Repository**: Opens the repository root in GitHub
- **Keyboard Shortcuts**: Quick access via keyboard shortcuts
- **Context Menu**: Right-click on files in the explorer or editor

## Usage

### Keyboard Shortcuts
- `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac): Open current file in GitHub
- `Ctrl+Shift+Alt+G` (or `Cmd+Shift+Alt+G` on Mac): Open current file at current line in GitHub

### Commands
1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Open in GitHub" and select the desired command

### Context Menu
- Right-click on any file in the Explorer
- Right-click in the editor
- Select "Open File in GitHub" or "Open File in GitHub (at current line)"

## Configuration

The extension can be configured in VS Code settings:

- `openInGithub.repositoryUrl`: The GitHub repository URL (default: `https://github.com/elastic/kibana`)
- `openInGithub.useCommitHash`: Use commit hash instead of branch name in URLs (default: `false`)

## Requirements

- The file must be in a git repository
- Git must be available in the system PATH
- The repository must have a remote origin pointing to GitHub

## Installation

### Quick Install (Recommended)

> [!IMPORTANT]
> This extension is not published to VSCode marketplace or anywhere else. It has no automated tests and it was generated using Claude Code. Use at your own risk.

Run the installation script to automatically download and install the extension:

```bash
curl -fsSL https://raw.githubusercontent.com/jloleysens/open-in-github/main/install.sh | bash
```

Or download and run manually:

```bash
wget https://raw.githubusercontent.com/jloleysens/open-in-github/main/install.sh
chmod +x install.sh
./install.sh
```

After installation, restart Cursor for the extension to be loaded.

### Manual Installation

Alternatively, you can install manually:

1. Clone or download this repository
2. Copy the extension files to `~/.cursor/extensions/open-in-github/`
3. Run `npm install` in the extension directory
4. Restart Cursor

## Troubleshooting

- **"File is not in a git repository"**: Make sure the file is within a git repository
- **"Failed to get git reference"**: Ensure git is installed and accessible from the command line
- **URL doesn't open**: Check that the repository URL is correct and accessible

## Development

This extension is built for the Kibana development environment and is configured to work with the Elastic Kibana repository by default.