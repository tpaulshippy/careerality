/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const iosRoot = path.join(__dirname, '..', 'ios');
const updatesEnvPath = path.join(iosRoot, '.xcode.env.updates');
const updatesResourcesScript = path.join(
  iosRoot,
  'Pods',
  'Target Support Files',
  'EXUpdates',
  'EXUpdates-resources.sh',
);
const forceBundling = 'export FORCE_BUNDLING=1\nunset SKIP_BUNDLING\n';

fs.writeFileSync(updatesEnvPath, forceBundling);

if (!fs.existsSync(updatesResourcesScript)) {
  throw new Error(`Unable to find the expo-updates resource script at ${updatesResourcesScript}`);
}

const resourceScript = fs.readFileSync(updatesResourcesScript, 'utf8');
if (!resourceScript.includes(forceBundling)) {
  const firstLineEnd = resourceScript.indexOf('\n');
  const insertionPoint = firstLineEnd === -1 ? resourceScript.length : firstLineEnd + 1;
  const patchedScript =
    resourceScript.slice(0, insertionPoint) + forceBundling + resourceScript.slice(insertionPoint);
  fs.writeFileSync(updatesResourcesScript, patchedScript);
}

process.stdout.write('Configured iOS release builds to embed the JavaScript launch asset.\n');
