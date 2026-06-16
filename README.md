# Open in GitHub Extension

A simple VS Code extension that allows you to quickly open the current file in its GitHub repository.

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

- `openInGithub.repositoryUrl`: Optional GitHub repository URL override. Leave empty to infer from git remotes.
- `openInGithub.useCommitHash`: Use commit hash instead of branch name in URLs (default: `false`)

When `openInGithub.repositoryUrl` is empty, the extension discovers the repository from configured git remotes in this order:

1. `upstream`, if it points to GitHub
2. `origin`, if it points to GitHub
3. The first other remote that points to GitHub

## Requirements

- The file must be in a git repository
- Git must be available in the system PATH
- The repository must have at least one GitHub remote, unless `openInGithub.repositoryUrl` is configured

## Installation

### Quick Install (Recommended)

> [!IMPORTANT]
> This extension is not published to VSCode marketplace or anywhere else. It has no automated tests and it was generated using Claude Code. Use at your own risk.

Run the installation script to automatically download and install the extension for Cursor and VS Code:

```bash
curl -fsSL https://raw.githubusercontent.com/jloleysens/open-in-github/main/install.sh | bash
```

When run from a local checkout, `./install.sh` installs the current local files instead of downloading from GitHub.

Or download and run manually:

```bash
wget https://raw.githubusercontent.com/jloleysens/open-in-github/main/install.sh
chmod +x install.sh
./install.sh
```

After installation, restart Cursor and VS Code for the extension to be loaded.

### Manual Installation

Alternatively, you can install manually:

1. Clone or download this repository
2. Copy the extension files to `~/.cursor/extensions/open-in-github/` and/or `~/.vscode/extensions/open-in-github/`
3. Run `npm install` in the extension directory
4. Restart Cursor and/or VS Code

## Troubleshooting

- **"File is not in a git repository"**: Make sure the file is within a git repository
- **"Failed to get git reference"**: Ensure git is installed and accessible from the command line
- **URL doesn't open**: Check that the repository URL or git remote URL is correct and accessible

## Development

Run the tests with:

```bash
npm test
```