#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const requiredInputs = [
  'src/camera/hooks/usePhotoCaptureTransaction.ts',
  'example/babel.config.js',
];

const excludedInputPatterns = [
  /(?:^|\/)Pods(?:\/|$)/,
  /(?:^|\/)build(?:\/|$)/,
  /(?:^|\/)\.gradle(?:\/|$)/,
];

function getTasks(platform) {
  const output = execFileSync(
    'yarn',
    ['turbo', 'run', `build:${platform}`, '--dry=json'],
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
  return inputs.some(
    (input) =>
      input === expected ||
      input.endsWith(`/${expected}`) ||
      (expected === 'example/babel.config.js' && input === 'babel.config.js')
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
  console.log(`[ok] ${task.taskId} (${inputs.length} inputs)`);
}

for (const platform of ['android', 'ios']) {
  const tasks = getTasks(platform);
  if (tasks.length === 0) {
    throw new Error(`Turbo dry-run 未找到 build:${platform} task`);
  }
  tasks.forEach((task) => assertTaskInputs(platform, task));
}
