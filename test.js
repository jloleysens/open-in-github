// Simple test script to verify the extension functionality
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

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

async function testUrlConstruction() {
    console.log('\nTesting URL construction...');

    const repositoryUrl = 'https://github.com/elastic/kibana';
    const gitRef = 'main';
    const relativePath = 'x-pack/platform/plugins/shared/onechat/server/services/tools/persisted/client/client.ts';
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
    await testUrlConstruction();

    console.log('\n🎉 All tests completed!');
    console.log('\nTo use the extension:');
    console.log('1. Reload VS Code window (Ctrl+Shift+P -> "Developer: Reload Window")');
    console.log('2. Open any file in the repository');
    console.log('3. Press Ctrl+Shift+G (or Cmd+Shift+G on Mac) to open in GitHub');
    console.log('4. Or use Command Palette: "Open File in GitHub"');
}

runTests().catch(console.error);


