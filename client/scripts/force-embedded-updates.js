/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const iosRoot = path.join(__dirname, '..', 'ios');
const updatesEnvPath = path.join(iosRoot, '.xcode.env.updates');
const appProjectPath = path.join(iosRoot, 'Careerality.xcodeproj', 'project.pbxproj');
const podsProjectPath = path.join(iosRoot, 'Pods', 'Pods.xcodeproj', 'project.pbxproj');
const forceBundling = 'export FORCE_BUNDLING=1\nunset SKIP_BUNDLING\n';
const forceBundlingPbx = 'export FORCE_BUNDLING=1\\nunset SKIP_BUNDLING\\n';

fs.writeFileSync(updatesEnvPath, forceBundling);

const patchBuildPhase = (projectPath, phaseName) => {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Unable to find the Xcode project at ${projectPath}`);
  }

  const project = fs.readFileSync(projectPath, 'utf8');
  const phaseStart = project.indexOf(phaseName);
  const shellScriptStart = project.indexOf('shellScript = "', phaseStart);

  if (phaseStart === -1 || shellScriptStart === -1) {
    throw new Error(`Unable to find the build phase ${phaseName} in ${projectPath}`);
  }

  if (project.slice(shellScriptStart).startsWith(`shellScript = "${forceBundlingPbx}`)) return;

  const insertionPoint = shellScriptStart + 'shellScript = "'.length;
  const patchedProject =
    project.slice(0, insertionPoint) + forceBundlingPbx + project.slice(insertionPoint);
  fs.writeFileSync(projectPath, patchedProject);
};

patchBuildPhase(appProjectPath, 'name = "Bundle React Native code and images";');
patchBuildPhase(
  podsProjectPath,
  'name = "[CP-User] Generate updates resources for expo-updates";',
);

if (!fs.existsSync(updatesEnvPath)) {
  throw new Error(`Unable to create the Expo updates environment file at ${updatesEnvPath}`);
}

process.stdout.write('Configured iOS release builds to embed the JavaScript launch asset.\n');
