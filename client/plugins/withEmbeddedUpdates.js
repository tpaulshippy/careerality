/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withEmbeddedUpdates(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const updatesEnvFile = path.join(projectRoot, '.xcode.env.updates');

      // EAS sets SKIP_BUNDLING after the eager bundle step. Clear it so the
      // release app still embeds a launch asset for its first offline launch.
      fs.writeFileSync(updatesEnvFile, 'export FORCE_BUNDLING=1\nunset SKIP_BUNDLING\n');
      return config;
    },
  ]);
};
