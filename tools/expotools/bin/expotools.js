#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');

const chalk = safeRequire('chalk');
const semver = safeRequire('semver');
const spawnAsync = safeRequire('@expo/spawn-async');

const nodeVersion = process.versions.node.split('-')[0]; // explode and truncate tag from version

// Validate that used Node version is supported
if (semver.satisfies(nodeVersion, '>=8.9.0')) {
  maybeRebuildAndRun().catch(error => {
    console.error(chalk.red(error.stack));
  });
} else {
  console.log(
    chalk.red(
      `Node version ${chalk.cyan(nodeVersion)} is not supported. Please use Node.js ${chalk.cyan('8.9.0')} or higher.`
    ),
  );
  process.exit(1);
}

async function maybeRebuildAndRun() {
  const { projectHash, isRebuildingRequired } = await checkForUpdates();

  if (isRebuildingRequired) {
    const ora = require('ora');
    const spinner = ora().start(
      `${chalk.cyan(chalk.bold('expotools'))} ${chalk.italic(`are not up to date - rebuilding...\n`)}`
    );

    await spawnAsync('yarn', { cwd: rootDir });
    await spawnAsync('yarn', ['run', 'clean'], { cwd: rootDir });

    try {
      await spawnAsync('yarn', ['run', 'build'], { cwd: rootDir });
    } catch (error) {
      // TypeScript compiler might fail because of errors but the code might have been generated anyway (status = 2).
      // Unfortunately, when running this script as a build phase in Xcode, build command rejects with a status = 1,
      // even though tsc exited with code = 2, so we use this stupid RegExp test here.
      if (!/exit code 2/.test(error.stderr)) {
        console.error(chalk.red(`Building failed: ${error.stack}`));
        console.error(error);
        process.exit(1);
        return;
      }
    }
    spinner.succeed();
  }

  // Write checksum to the file.
  await fs.writeFile(checksumFilePath, projectHash);

  run();
}

async function checkForUpdates() {
  const rootDir = path.dirname(__dirname);
  const checksumFilePath = path.join(rootDir, 'build', '.checksum');

  const projectHash = await calculateProjectHash(rootDir);
  const currentHash = readCurrentHash(checksumFilePath);

  return {
    projectHash,
    isRebuildingRequired: projectHash !== currentHash,
  };
}

function readCurrentHash(checksumFilePath) {
  if (!fs.existsSync(checksumFilePath)) {
    return '';
  }
  return fs.readFileSync(checksumFilePath, 'utf8');
}

async function calculateProjectHash(rootDir) {
  if (canRequire('folder-hash')) {
    const { hashElement } = require('folder-hash');
    const { hash } = await hashElement(rootDir, {
      folders: {
        exclude: ['build', 'node_modules'],
      },
      files: {
        include: ['*.ts', 'expotools.js', 'yarn.lock', 'tsconfig.js'],
      },
    });
    return hash;
  }
  return null;
}

function canRequire(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch (error) {
    return false;
  }
}
function safeRequire(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    return null;
  }
}

function run() {
  require('../build/expotools-cli.js').run();
}
