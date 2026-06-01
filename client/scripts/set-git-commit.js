const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  const versionFile = path.join(__dirname, '..', 'src', 'constants', 'version.ts');
  
  const content = `export const APP_VERSION = '1.0.0';
export const GIT_COMMIT_PREFIX = '${commitHash}';
`;
  
  fs.writeFileSync(versionFile, content);
  console.log(`Set GIT_COMMIT_PREFIX to ${commitHash}`);
} catch (error) {
  console.error('Failed to set git commit hash:', error.message);
  process.exit(1);
}
