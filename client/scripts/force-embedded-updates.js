/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const iosRoot = path.join(__dirname, '..', 'ios');
const updatesEnvPath = path.join(iosRoot, '.xcode.env.updates');
const podsProjectPath = path.join(iosRoot, 'Pods', 'Pods.xcodeproj', 'project.pbxproj');
const forceBundling = 'export FORCE_BUNDLING=1\nunset SKIP_BUNDLING\n';
const forceBundlingPbx = 'export FORCE_BUNDLING=1\\nunset SKIP_BUNDLING\\n';

fs.writeFileSync(updatesEnvPath, forceBundling);

if (!fs.existsSync(podsProjectPath)) {
  throw new Error(`Unable to find the CocoaPods project at ${podsProjectPath}`);
}

const podsProject = fs.readFileSync(podsProjectPath, 'utf8');
const phaseName = 'name = "[CP-User] Generate updates resources for expo-updates";';
const phaseStart = podsProject.indexOf(phaseName);
const shellScriptStart = podsProject.indexOf('shellScript = "', phaseStart);

if (phaseStart === -1 || shellScriptStart === -1) {
  throw new Error('Unable to find the expo-updates resource build phase in the CocoaPods project');
}

if (!podsProject.slice(shellScriptStart).startsWith(`shellScript = "${forceBundlingPbx}`)) {
  const insertionPoint = shellScriptStart + 'shellScript = "'.length;
  const patchedPodsProject =
    podsProject.slice(0, insertionPoint) + forceBundlingPbx + podsProject.slice(insertionPoint);
  fs.writeFileSync(podsProjectPath, patchedPodsProject);
}

process.stdout.write('Configured iOS release builds to embed the JavaScript launch asset.\n');
