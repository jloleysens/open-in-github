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
        const repositoryUrl = config.get('repositoryUrl', 'https://github.com/elastic/kibana');
        const useCommitHash = config.get('useCommitHash', false);

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
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
        const repositoryUrl = config.get('repositoryUrl', 'https://github.com/elastic/kibana');

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
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
        const repositoryUrl = config.get('repositoryUrl', 'https://github.com/elastic/kibana');

        // Get git repository root
        const gitRoot = await getGitRoot(filePath);
        if (!gitRoot) {
            showError('File is not in a git repository');
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
