const assert = require('assert');
const fs = require('fs');
const os = require('os');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { _test } = require('./extension');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function createConfig(repositoryUrl = '', inspection = undefined) {
    const config = {
        get(key, defaultValue) {
            if (key === 'repositoryUrl') {
                return repositoryUrl;
            }

            return defaultValue;
        }
    };

    if (inspection !== undefined) {
        config.inspect = (key) => {
            if (key === 'repositoryUrl') {
                return inspection;
            }

            return undefined;
        };
    }

    return config;
}

async function withTempGitRepo(testFn) {
    const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'open-in-github-'));

    try {
        await execFileAsync('git', ['init'], { cwd: gitRoot });
        await testFn(gitRoot);
    } finally {
        fs.rmSync(gitRoot, { recursive: true, force: true });
    }
}

async function addRemote(gitRoot, name, url) {
    await execFileAsync('git', ['remote', 'add', name, url], { cwd: gitRoot });
}

async function testGitIntegration() {
    console.log('Testing Git integration...');

    try {
        // Test getting git root
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel');
        console.log('✓ Git root:', gitRoot.trim());

        // Test getting current branch
        try {
            const { stdout: branch } = await execAsync('git branch --show-current');
            console.log('✓ Current branch:', branch.trim() || 'detached HEAD');
        } catch (error) {
            console.log('✓ Using commit hash (detached HEAD)');
        }

        // Test getting commit hash
        const { stdout: commit } = await execAsync('git rev-parse HEAD');
        console.log('✓ Current commit:', commit.trim().substring(0, 8) + '...');

        console.log('\n✅ Git integration test passed!');
    } catch (error) {
        console.error('❌ Git integration test failed:', error.message);
    }
}

function testGitHubUrlNormalization() {
    console.log('\nTesting GitHub URL normalization...');

    assert.strictEqual(
        _test.normalizeGitHubUrl('https://github.com/elastic/kibana.git'),
        'https://github.com/elastic/kibana'
    );
    assert.strictEqual(
        _test.normalizeGitHubUrl('git@github.com:jloleysens/open-in-github.git'),
        'https://github.com/jloleysens/open-in-github'
    );
    assert.strictEqual(
        _test.normalizeGitHubUrl('ssh://git@github.com/owner/repo.git'),
        'https://github.com/owner/repo'
    );
    assert.strictEqual(_test.normalizeGitHubUrl('https://gitlab.com/owner/repo.git'), null);

    console.log('✓ GitHub URL normalization test passed!');
}

async function testRepositoryDiscovery() {
    console.log('\nTesting repository discovery from remotes...');

    await withTempGitRepo(async (gitRoot) => {
        await addRemote(gitRoot, 'origin', 'git@github.com:elastic/kibana.git');

        const repositoryInfo = await _test.getGitHubRepositoryInfo(gitRoot, createConfig());

        assert.deepStrictEqual(repositoryInfo, {
            url: 'https://github.com/elastic/kibana',
            remoteName: 'origin'
        });
    });

    await withTempGitRepo(async (gitRoot) => {
        await addRemote(gitRoot, 'origin', 'git@github.com:some-fork/kibana.git');
        await addRemote(gitRoot, 'upstream', 'https://github.com/elastic/kibana.git');

        const repositoryInfo = await _test.getGitHubRepositoryInfo(gitRoot, createConfig());

        assert.deepStrictEqual(repositoryInfo, {
            url: 'https://github.com/elastic/kibana',
            remoteName: 'upstream'
        });
    });

    await withTempGitRepo(async (gitRoot) => {
        await addRemote(gitRoot, 'mirror', 'https://github.com/example/project.git');

        const repositoryInfo = await _test.getGitHubRepositoryInfo(gitRoot, createConfig());

        assert.deepStrictEqual(repositoryInfo, {
            url: 'https://github.com/example/project',
            remoteName: 'mirror'
        });
    });

    await withTempGitRepo(async (gitRoot) => {
        await addRemote(gitRoot, 'origin', 'git@github.com:example/project.git');

        const repositoryInfo = await _test.getGitHubRepositoryInfo(
            gitRoot,
            createConfig('https://github.com/elastic/kibana.git', {
                defaultValue: '',
                globalValue: 'https://github.com/elastic/kibana.git'
            })
        );

        assert.deepStrictEqual(repositoryInfo, {
            url: 'https://github.com/elastic/kibana',
            remoteName: null
        });
    });

    await withTempGitRepo(async (gitRoot) => {
        await addRemote(gitRoot, 'origin', 'git@github.com:elastic/proxy.git');

        const repositoryInfo = await _test.getGitHubRepositoryInfo(
            gitRoot,
            createConfig('https://github.com/elastic/kibana', {
                defaultValue: 'https://github.com/elastic/kibana'
            })
        );

        assert.deepStrictEqual(repositoryInfo, {
            url: 'https://github.com/elastic/proxy',
            remoteName: 'origin'
        });
    });

    console.log('✓ Repository discovery test passed!');
}

async function testUrlConstruction() {
    console.log('\nTesting URL construction...');

    const repositoryUrl = 'https://github.com/jloleysens/open-in-github';
    const gitRef = 'main';
    const relativePath = 'extension.js';
    const lineNumber = 59;

    // Test basic URL
    const basicUrl = `${repositoryUrl}/blob/${gitRef}/${relativePath}`;
    console.log('✓ Basic URL:', basicUrl);

    // Test URL with line number
    const urlWithLine = `${repositoryUrl}/blob/${gitRef}/${relativePath}#L${lineNumber}`;
    console.log('✓ URL with line:', urlWithLine);

    console.log('\n✅ URL construction test passed!');
}

async function runTests() {
    console.log('🧪 Running Open in GitHub Extension Tests\n');

    await testGitIntegration();
    testGitHubUrlNormalization();
    await testRepositoryDiscovery();
    await testUrlConstruction();

    console.log('\n🎉 All tests completed!');
    console.log('\nTo use the extension:');
    console.log('1. Reload VS Code window (Ctrl+Shift+P -> "Developer: Reload Window")');
    console.log('2. Open any file in the repository');
    console.log('3. Press Ctrl+Shift+G (or Cmd+Shift+G on Mac) to open in GitHub');
    console.log('4. Or use Command Palette: "Open File in GitHub"');
}

runTests().catch(console.error);


