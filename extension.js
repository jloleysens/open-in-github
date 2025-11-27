const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Get the git repository root for a given file path
 * @param {string} filePath - The file path to check
 * @returns {Promise<string|null>} - The git repository root or null if not in a git repo
 */
async function getGitRoot(filePath) {
    try {
        const { stdout } = await execAsync('git rev-parse --show-toplevel', {
            cwd: path.dirname(filePath)
        });
        return stdout.trim();
    } catch (error) {
        return null;
    }
}

/**
 * Get the current git branch or commit hash
 * @param {string} gitRoot - The git repository root
 * @param {boolean} useCommitHash - Whether to use commit hash instead of branch name
 * @returns {Promise<string>} - The branch name or commit hash
 */
async function getGitRef(gitRoot, useCommitHash = false) {
    try {
        if (useCommitHash) {
            const { stdout } = await execAsync('git rev-parse HEAD', { cwd: gitRoot });
            return stdout.trim();
        } else {
            // Try to get current branch, fallback to commit hash if detached HEAD
            try {
                const { stdout } = await execAsync('git branch --show-current', { cwd: gitRoot });
                const branch = stdout.trim();
                if (branch) {
                    return branch;
                }
            } catch (error) {
                // Fallback to commit hash if no branch
            }
            const { stdout } = await execAsync('git rev-parse HEAD', { cwd: gitRoot });
            return stdout.trim();
        }
    } catch (error) {
        throw new Error('Failed to get git reference');
    }
}

/**
 * Get the relative path from git root to the file
 * @param {string} filePath - The absolute file path
 * @param {string} gitRoot - The git repository root
 * @returns {string} - The relative path from git root
 */
function getRelativePath(filePath, gitRoot) {
    return path.relative(gitRoot, filePath).replace(/\\/g, '/');
}

/**
 * Get the URL for a specific git remote
 * @param {string} gitRoot - The git repository root
 * @param {string} remoteName - The name of the remote
 * @returns {Promise<string|null>} - The remote URL or null if remote doesn't exist
 */
async function getRemoteUrl(gitRoot, remoteName) {
    try {
        const { stdout } = await execAsync(`git remote get-url ${remoteName}`, { cwd: gitRoot });
        return stdout.trim();
    } catch (error) {
        return null;
    }
}

/**
 * Get all git remote names
 * @param {string} gitRoot - The git repository root
 * @returns {Promise<string[]>} - Array of remote names
 */
async function getAllRemotes(gitRoot) {
    try {
        const { stdout } = await execAsync('git remote', { cwd: gitRoot });
        return stdout.trim().split('\n').filter(name => name.length > 0);
    } catch (error) {
        return [];
    }
}

/**
 * Check if a URL points to GitHub
 * @param {string} url - The URL to check
 * @returns {boolean} - True if URL points to GitHub
 */
function isGitHubUrl(url) {
    if (!url) return false;
    // Check for github.com in the URL
    return /github\.com/.test(url);
}

/**
 * Normalize a GitHub URL to https://github.com/org/repo format
 * @param {string} url - The GitHub URL in any format
 * @returns {string|null} - Normalized URL or null if invalid
 */
function normalizeGitHubUrl(url) {
    if (!url) return null;

    try {
        // Handle different URL formats
        // https://github.com/org/repo
        // https://github.com/org/repo.git
        // git@github.com:org/repo.git
        // ssh://git@github.com/org/repo.git
        let match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
        if (match) {
            return `https://github.com/${match[1]}/${match[2]}`;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get GitHub repository URL following strict priority order:
 * 1. Configuration setting (if exists)
 * 2. Upstream remote (if exists and points to GitHub)
 * 3. Origin remote (if exists and points to GitHub)
 * 4. First GitHub remote from all remotes
 * 5. null if none found
 * @param {string} gitRoot - The git repository root
 * @param {vscode.WorkspaceConfiguration} config - The workspace configuration
 * @returns {Promise<string|null>} - The GitHub repository URL or null if not found
 */
async function getGitHubRepositoryUrl(gitRoot, config) {
    // 1. Check config first (highest priority)
    const configUrl = config.get('repositoryUrl');
    if (configUrl) {
        return configUrl;
    }

    // 2. Check upstream remote
    const upstreamUrl = await getRemoteUrl(gitRoot, 'upstream');
    if (upstreamUrl && isGitHubUrl(upstreamUrl)) {
        const normalized = normalizeGitHubUrl(upstreamUrl);
        if (normalized) {
            return normalized;
        }
    }

    // 3. Check origin remote
    const originUrl = await getRemoteUrl(gitRoot, 'origin');
    if (originUrl && isGitHubUrl(originUrl)) {
        const normalized = normalizeGitHubUrl(originUrl);
        if (normalized) {
            return normalized;
        }
    }

    // 4. Check all remotes for first GitHub URL
    const allRemotes = await getAllRemotes(gitRoot);
    for (const remote of allRemotes) {
        const remoteUrl = await getRemoteUrl(gitRoot, remote);
        if (remoteUrl && isGitHubUrl(remoteUrl)) {
            const normalized = normalizeGitHubUrl(remoteUrl);
            if (normalized) {
                return normalized;
            }
        }
    }

    // 5. Return null if nothing found
    return null;
}

/**
 * Construct the GitHub URL for a file
 * @param {string} repositoryUrl - The base repository URL
 * @param {string} gitRef - The git reference (branch or commit)
 * @param {string} relativePath - The relative path from git root
 * @param {number} lineNumber - Optional line number
 * @returns {string} - The GitHub URL
 */
function constructGitHubUrl(repositoryUrl, gitRef, relativePath, lineNumber = null) {
    let url = `${repositoryUrl}/blob/${gitRef}/${relativePath}`;
    if (lineNumber) {
        url += `#L${lineNumber}`;
    }
    return url;
}

/**
 * Open a URL in the default browser
 * @param {string} url - The URL to open
 */
async function openInBrowser(url) {
    const {default: open} = require('open');
    await open(url);
}

/**
 * Show an error message to the user
 * @param {string} message - The error message
 */
function showError(message) {
    vscode.window.showErrorMessage(`Open in GitHub: ${message}`);
}

/**
 * Open the current file in GitHub
 * @param {boolean} includeLineNumber - Whether to include the current line number
 */
async function openFileInGitHub(includeLineNumber = false) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showError('No active editor found');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const config = vscode.workspace.getConfiguration('openInGithub');
        const useCommitHash = config.get('useCommitHash', false);

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
            return;
        }

        // Get GitHub repository URL with strict priority order
        const repositoryUrl = await getGitHubRepositoryUrl(gitRoot, config);
        if (!repositoryUrl) {
            showError('Could not determine GitHub repository URL. Please configure openInGithub.repositoryUrl or ensure a GitHub remote exists.');
            return;
        }

        // Get git reference (branch or commit)
        const gitRef = await getGitRef(gitRoot, useCommitHash);

        // Get relative path from git root
        const relativePath = getRelativePath(filePath, gitRoot);

        // Get line number if requested
        let lineNumber = null;
        if (includeLineNumber) {
            lineNumber = editor.selection.active.line + 1; // GitHub uses 1-based line numbers
        }

        // Construct and open URL
        const url = constructGitHubUrl(repositoryUrl, gitRef, relativePath, lineNumber);
        await openInBrowser(url);

        // Show success message
        vscode.window.showInformationMessage(`Opened in GitHub: ${relativePath}`);
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Open the repository root in GitHub
 */
async function openRepositoryInGitHub() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showError('No active editor found');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const config = vscode.workspace.getConfiguration('openInGithub');

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
            return;
        }

        // Get GitHub repository URL with strict priority order
        const repositoryUrl = await getGitHubRepositoryUrl(gitRoot, config);
        if (!repositoryUrl) {
            showError('Could not determine GitHub repository URL. Please configure openInGithub.repositoryUrl or ensure a GitHub remote exists.');
            return;
        }

        // Get git reference
        const useCommitHash = config.get('useCommitHash', false);
        const gitRef = await getGitRef(gitRoot, useCommitHash);

        // Open repository root
        const url = `${repositoryUrl}/tree/${gitRef}`;
        await openInBrowser(url);

        vscode.window.showInformationMessage('Opened repository in GitHub');
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Get the commit hash for a specific line using git blame
 * @param {string} gitRoot - The git repository root
 * @param {string} filePath - The absolute file path
 * @param {number} lineNumber - The line number (1-based)
 * @returns {Promise<string|null>} - The commit hash or null if not found
 */
async function getCommitHashFromBlame(gitRoot, filePath, lineNumber) {
    try {
        const relativePath = getRelativePath(filePath, gitRoot);
        const { stdout } = await execAsync(
            `git blame -L ${lineNumber},${lineNumber} --porcelain "${relativePath}"`,
            { cwd: gitRoot }
        );

        // Parse git blame output to extract commit hash
        // The first line contains the commit hash
        const lines = stdout.split('\n');
        if (lines.length > 0) {
            const match = lines[0].match(/^([a-f0-9]{40})/);
            if (match) {
                return match[1];
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Extract PR number from commit message
 * @param {string} gitRoot - The git repository root
 * @param {string} commitHash - The commit hash
 * @returns {Promise<string|null>} - The PR number or null if not found
 */
async function getPRNumberFromCommit(gitRoot, commitHash) {
    try {
        const { stdout } = await execAsync(`git log -1 --format=%B ${commitHash}`, { cwd: gitRoot });
        const commitMessage = stdout;

        // Try various patterns to find PR number
        // Pattern 1: Merge pull request #123
        let match = commitMessage.match(/Merge pull request #(\d+)/i);
        if (match) {
            return match[1];
        }

        // Pattern 2: fixes #123, closes #123, resolves #123, etc.
        match = commitMessage.match(/(?:fixes?|closes?|resolves?|refs?)[\s:]*#(\d+)/i);
        if (match) {
            return match[1];
        }

        // Pattern 3: Just #123 (standalone PR reference)
        match = commitMessage.match(/#(\d+)/);
        if (match) {
            return match[1];
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Extract organization and repository name from repository URL
 * @param {string} repositoryUrl - The repository URL
 * @returns {Object|null} - Object with org and repo properties, or null if invalid
 */
function extractOrgAndRepo(repositoryUrl) {
    try {
        // Handle different URL formats
        // https://github.com/org/repo
        // https://github.com/org/repo.git
        // git@github.com:org/repo.git
        let match = repositoryUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
        if (match) {
            return {
                org: match[1],
                repo: match[2]
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Open the PR for the last changed line in GitHub
 */
async function openPRForLastChangedLine() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showError('No active editor found');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const config = vscode.workspace.getConfiguration('openInGithub');

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
            return;
        }

        // Get GitHub repository URL with strict priority order
        const repositoryUrl = await getGitHubRepositoryUrl(gitRoot, config);
        if (!repositoryUrl) {
            showError('Could not determine GitHub repository URL. Please configure openInGithub.repositoryUrl or ensure a GitHub remote exists.');
            return;
        }

        // Get current line number (1-based for git blame)
        const lineNumber = editor.selection.active.line + 1;

        // Get commit hash from git blame
        const commitHash = await getCommitHashFromBlame(gitRoot, filePath, lineNumber);
        if (!commitHash) {
            showError('Could not determine commit for this line');
            return;
        }

        // Get PR number from commit message
        const prNumber = await getPRNumberFromCommit(gitRoot, commitHash);
        if (!prNumber) {
            showError('Could not find PR number in commit message');
            return;
        }

        // Extract org and repo from repository URL
        const orgRepo = extractOrgAndRepo(repositoryUrl);
        if (!orgRepo) {
            showError('Invalid repository URL format');
            return;
        }

        // Construct and open PR URL
        const prUrl = `https://github.com/${orgRepo.org}/${orgRepo.repo}/pull/${prNumber}`;
        await openInBrowser(prUrl);

        vscode.window.showInformationMessage(`Opened PR #${prNumber} in GitHub`);
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context - The extension context
 */
function activate(context) {
    console.log('Open in GitHub extension is now active!');

    // Register commands
    const openFileCommand = vscode.commands.registerCommand('openInGithub.openFile', () => {
        openFileInGitHub(false);
    });

    const openFileAtLineCommand = vscode.commands.registerCommand('openInGithub.openFileAtLine', () => {
        openFileInGitHub(true);
    });

    const openRepositoryCommand = vscode.commands.registerCommand('openInGithub.openRepository', () => {
        openRepositoryInGitHub();
    });

    const openPRForLineCommand = vscode.commands.registerCommand('openInGithub.openPRForLine', () => {
        openPRForLastChangedLine();
    });

    // Add commands to context for disposal
    context.subscriptions.push(openFileCommand);
    context.subscriptions.push(openFileAtLineCommand);
    context.subscriptions.push(openRepositoryCommand);
    context.subscriptions.push(openPRForLineCommand);
}

/**
 * Deactivate the extension
 */
function deactivate() {
    console.log('Open in GitHub extension is now deactivated');
}

module.exports = {
    activate,
    deactivate
};
