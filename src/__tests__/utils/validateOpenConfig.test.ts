import { validateOpenConfig } from '../../utils/validateOpenConfig';

const invalidResult = {
  status: 'failed',
  error: { reason: 'invalid_input', message: expect.any(String) },
};

const validConfig = {
  modes: [{ mode: 'single' as const }],
  retention: 'clear' as const,
};

describe('validateOpenConfig', () => {
  it.each([
    ['null', null],
    ['array', []],
    ['string', 'camera'],
    ['missing modes', { retention: 'clear' }],
    ['non-array modes', { ...validConfig, modes: {} }],
    ['empty modes', { ...validConfig, modes: [] }],
  ])('rejects %s', (_label, value) => {
    expect(validateOpenConfig(value)).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it.each([
    ['mode', { mode: 'burst' }],
    ['photo video duration', { mode: 'single', maxDurationSeconds: 1 }],
    ['video photo quality', { mode: 'video', quality: 0.9 }],
    ['video photo HDR', { mode: 'video', hdr: true }],
    ['video photo priority', { mode: 'video', qualityPriority: 'quality' }],
    ['photo video bitrate', { mode: 'single', bitRate: 2000000 }],
  ])('rejects an unknown modes %s', (_label, modes) => {
    expect(
      validateOpenConfig({
        ...validConfig,
        modes: [modes],
      })
    ).toEqual({ ok: false, result: invalidResult });
  });

  it('rejects a sparse modes array with an internal hole', () => {
    const modes = new Array<unknown>(3);
    modes[0] = { mode: 'single' };
    modes[2] = { mode: 'video' };

    expect(
      validateOpenConfig({
        ...validConfig,
        modes,
      })
    ).toEqual({ ok: false, result: invalidResult });
  });

  it('rejects an unknown retention', () => {
    expect(validateOpenConfig({ ...validConfig, retention: 'append' })).toEqual(
      { ok: false, result: invalidResult }
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    'rejects invalid quality %p',
    (quality) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          modes: [{ mode: 'single', quality }],
        })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0, -1])(
    'rejects invalid maxDurationSeconds %p',
    (maxDurationSeconds) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          modes: [{ mode: 'video', maxDurationSeconds }],
        })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'rejects invalid videoBitRate %p',
    (videoBitRate) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          modes: [{ mode: 'video', bitRate: videoBitRate }],
        })
      ).toEqual({
        ok: false,
        result: invalidResult,
      });
    }
  );

  it.each([
    ['non-object watermark', 'stamp'],
    ['array watermark', []],
    ['missing lines', { position: 'top-left' }],
    ['non-array lines', { lines: 'stamp' }],
    ['non-string lines item', { lines: ['stamp', 1] }],
    ['unknown position', { lines: ['stamp'], position: 'center' }],
  ])('rejects %s', (_label, watermark) => {
    expect(validateOpenConfig({ ...validConfig, watermark })).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it('rejects sparse watermark lines with an internal hole', () => {
    const lines = new Array<unknown>(3);
    lines[0] = 'title';
    lines[2] = 'body';

    expect(
      validateOpenConfig({
        ...validConfig,
        watermark: { lines },
      })
    ).toEqual({ ok: false, result: invalidResult });
  });

  it.each(['fast', false, 1])(
    'rejects invalid photoQualityPrioritization %p',
    (photoQualityPrioritization) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          modes: [
            { mode: 'single', qualityPriority: photoQualityPrioritization },
          ],
        })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each(['true', 1, null])('rejects invalid photoHDR %p', (photoHDR) => {
    expect(
      validateOpenConfig({
        ...validConfig,
        modes: [{ mode: 'single', hdr: photoHDR }],
      })
    ).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it.each([
    ['initialFacing', { initialFacing: 'external' }],
    ['initialFlash', { initialFlash: 'torch' }],
    ['duplicate modes', { modes: [{ mode: 'single' }, { mode: 'single' }] }],
  ])('rejects invalid %s', (_label, fields) => {
    expect(validateOpenConfig({ ...validConfig, ...fields })).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it.each([1, 2_147_483_647])(
    'accepts valid bitrate boundary %s, explicit false HDR and empty watermark lines',
    (bitRate) => {
      const config = {
        modes: [
          {
            mode: 'single',
            quality: 0,
            qualityPriority: 'quality',
            hdr: false,
          },
          { mode: 'continuous', quality: 1 },
          {
            mode: 'video',
            maxDurationSeconds: Number.MIN_VALUE,
            bitRate,
          },
        ],
        initialFacing: 'front',
        initialFlash: 'auto',
        retention: 'retain',
        watermark: { lines: [], position: 'bottom-center' },
      };
      expect(validateOpenConfig(config)).toEqual({ ok: true, config });
    }
  );

  it('does not modify the input and returns a deep session snapshot', () => {
    const mode = {
      mode: 'single',
      quality: 0.8,
      qualityPriority: 'balanced',
      hdr: true,
    };
    const lines = ['title', 'body'];
    const watermark = { lines, position: 'top-right' };
    const modes = [mode];
    const config = {
      modes,
      initialFacing: 'back',
      initialFlash: 'on',
      retention: 'clear',
      watermark,
    };
    const before = JSON.parse(JSON.stringify(config));
    const validated = validateOpenConfig(config);
    expect(config).toEqual(before);
    expect(validated).toEqual({ ok: true, config });
    if (!validated.ok) throw new Error('expected valid config');
    expect(validated.config).not.toBe(config);
    expect(validated.config.modes).not.toBe(modes);
    expect(validated.config.modes[0]).not.toBe(mode);
    expect(validated.config.watermark).not.toBe(watermark);
    expect(validated.config.watermark?.lines).not.toBe(lines);
    modes.push({ ...mode, mode: 'continuous' });
    mode.quality = 0.1;
    watermark.position = 'bottom-left';
    lines.push('late mutation');
    expect(validated.config).toEqual(before);
  });
});
