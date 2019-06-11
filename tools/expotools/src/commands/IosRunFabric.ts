import path from 'path';
import spawnAsync from '@expo/spawn-async';
import { Command } from 'commander/typings';

import * as Directories from '../Directories';
import { getTemplateSubstitutions } from '../dynamic-macros/generateDynamicMacros';

async function action(options) {
  const iosDir = Directories.getIosDir();
  const fabricPath = options.fabricPath || path.join(iosDir, 'Pods', 'Fabric', 'run');
  const templateSubstitutions = await getTemplateSubstitutions();

  await spawnAsync(
    '/bin/sh',
    [
      fabricPath,
      templateSubstitutions.FABRIC_API_KEY,
      templateSubstitutions.FABRIC_API_SECRET,
    ],
    {
      stdio: 'inherit',
      cwd: iosDir,
    }
  );
}

export default (program: Command) => {
  program
    .command('ios-run-fabric')
    .description('Runs Fabric script that is meant to be run as a Run Script in "Build Phases" section of Xcode project.')
    .option('--fabricPath [string]', 'Path to Fabric\'s run script. Defaults to "ios/Pods/Fabric/run".')
    .asyncAction(action);
}
