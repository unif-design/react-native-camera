#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const requiredInputs = [
  'src/camera/hooks/usePhotoCaptureTransaction.ts',
  'example/babel.config.js',
  'example/src/App.tsx',
];

const excludedInputPatterns = [
  /(?:^|\/)__tests__(?:\/|$)/,
  /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/,
  /(?:^|\/)Pods(?:\/|$)/,
  /(?:^|\/)build(?:\/|$)/,
  /(?:^|\/)\.gradle(?:\/|$)/,
];

const requiredNativeExclusions = [
  '!$TURBO_ROOT$/src/__tests__/**',
  '!$TURBO_ROOT$/src/**/__tests__/**',
  '!$TURBO_ROOT$/src/*.test.*',
  '!$TURBO_ROOT$/src/**/*.test.*',
  '!$TURBO_ROOT$/example/src/__tests__/**',
  '!$TURBO_ROOT$/example/src/**/__tests__/**',
  '!$TURBO_ROOT$/example/src/*.test.*',
  '!$TURBO_ROOT$/example/src/**/*.test.*',
];

const turboConfig = JSON.parse(readFileSync('turbo.json', 'utf8'));
const cacheDirectory = join(process.cwd(), '.turbo/check-inputs');
for (const platform of ['android', 'ios']) {
  const taskName = `@unif/react-native-camera-example#build:${platform}`;
  const configuredInputs = turboConfig.tasks[taskName]?.inputs ?? [];
  for (const exclusion of requiredNativeExclusions) {
    if (!configuredInputs.includes(exclusion)) {
      throw new Error(`${taskName} 缺少 test-only 排除 input: ${exclusion}`);
    }
  }
}

function getTasks(platform) {
  const output = execFileSync(
    'yarn',
    [
      'turbo',
      'run',
      `build:${platform}`,
      '--dry=json',
      `--cache-dir=${cacheDirectory}`,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  const report = JSON.parse(output);
  return report.tasks.filter((task) =>
    task.taskId.endsWith(`#build:${platform}`)
  );
}

function includesInput(inputs, expected) {
  const workspaceRelative = expected.startsWith('example/')
    ? expected.slice('example/'.length)
    : null;
  return inputs.some(
    (input) =>
      input === expected ||
      input.endsWith(`/${expected}`) ||
      (workspaceRelative != null && input === workspaceRelative)
  );
}

function assertTaskInputs(platform, task) {
  const inputs = Object.keys(task.inputs);
  for (const expected of requiredInputs) {
    if (!includesInput(inputs, expected)) {
      throw new Error(`${task.taskId} 缺少 Turbo input: ${expected}`);
    }
  }
  for (const pattern of excludedInputPatterns) {
    const leaked = inputs.find((input) => pattern.test(input));
    if (leaked != null) {
      throw new Error(`${task.taskId} 不应把缓存/输出纳入 input: ${leaked}`);
    }
  }
  const oppositePlatform = platform === 'android' ? 'ios' : 'android';
  const oppositePlatformPattern = new RegExp(
    `(?:^|/)${oppositePlatform}(?:/|$)`
  );
  const crossPlatformInput = inputs.find((input) =>
    oppositePlatformPattern.test(input)
  );
  if (crossPlatformInput != null) {
    throw new Error(
      `${task.taskId} 不应纳入 ${oppositePlatform} input: ${crossPlatformInput}`
    );
  }
  console.log(`[ok] ${task.taskId} (${inputs.length} inputs)`);
}

for (const platform of ['android', 'ios']) {
  const tasks = getTasks(platform);
  if (tasks.length !== 1) {
    throw new Error(
      `Turbo dry-run 的 build:${platform} 必须只有 example task，实际 ${tasks.length}`
    );
  }
  tasks.forEach((task) => assertTaskInputs(platform, task));
}
