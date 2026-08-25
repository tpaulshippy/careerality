/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withEmbeddedUpdates(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      const projectFile = path.join(projectRoot, `${projectName}.xcodeproj`, 'project.pbxproj');
      const project = fs.readFileSync(projectFile, 'utf8');

      fs.writeFileSync(projectFile, project.replace(/SKIP_BUNDLING/g, 'FORCE_BUNDLING'));
      return config;
    },
  ]);
};
