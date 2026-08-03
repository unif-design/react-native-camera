import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function productionSource(file: string): string {
  return readFileSync(join(process.cwd(), 'src/camera', file), 'utf8');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

it('uses transactional production hooks', () => {
  const container = productionSource('Container.tsx');

  expect(container).toContain('usePhotoCaptureTransaction');
  expect(container).toContain('useVideoTransaction');
  expect(container).toContain('useCameraSessionController');
});

it('keeps removed legacy capture implementations and references out of src', () => {
  const legacySymbols = [
    ['use', 'Capture', 'Flow'].join(''),
    ['use', 'Video', 'Recorder'].join(''),
    ['crop', 'To', 'Ratio'].join(''),
    ['burn', 'Watermark'].join(''),
    ['on', 'Spontaneous', 'Video', 'Finish'].join(''),
    ['manual', 'Stop', 'Requested', 'Ref'].join(''),
  ];
  const removedFiles = [
    join('camera', 'hooks', `${legacySymbols[0]}.ts`),
    join('camera', 'hooks', `${legacySymbols[1]}.ts`),
    join('camera', 'watermark', `${legacySymbols[2]}.ts`),
    join('camera', 'watermark', `${legacySymbols[3]}.ts`),
    join('__tests__', 'camera', 'hooks', `${legacySymbols[0]}.test.ts`),
    join('__tests__', 'camera', 'hooks', `${legacySymbols[1]}.test.ts`),
    join('__tests__', 'camera', 'watermark', `${legacySymbols[2]}.test.ts`),
    join('__tests__', 'camera', 'watermark', `${legacySymbols[3]}.test.ts`),
  ];
  const srcRoot = join(process.cwd(), 'src');
  const thisTest = join(
    srcRoot,
    '__tests__',
    'camera',
    'productionWiring.test.ts'
  );
  const references = sourceFiles(srcRoot)
    .filter((file) => file !== thisTest)
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return legacySymbols
        .filter((symbol) => source.includes(symbol))
        .map((symbol) => `${file}:${symbol}`);
    });

  expect(
    removedFiles.filter((file) => existsSync(join(srcRoot, file)))
  ).toEqual([]);
  expect(references).toEqual([]);
});
