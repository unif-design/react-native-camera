import { validateOpenConfig } from '../../utils/validateOpenConfig';

const invalidResult = {
  code: 500,
  data: [],
  message: 'invalid_config',
};

const validConfig = {
  cameraMode: [{ mode: 'single' as const }],
  dataRetainedMode: 'clear' as const,
};

describe('validateOpenConfig', () => {
  it.each([
    ['null', null],
    ['array', []],
    ['string', 'camera'],
    ['missing cameraMode', { dataRetainedMode: 'clear' }],
    ['non-array cameraMode', { ...validConfig, cameraMode: {} }],
    ['empty cameraMode', { ...validConfig, cameraMode: [] }],
  ])('rejects %s', (_label, value) => {
    expect(validateOpenConfig(value)).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it.each([
    ['mode', { mode: 'burst' }],
    ['type', { mode: 'single', type: 'external' }],
    ['flashMode', { mode: 'single', flashMode: 'torch' }],
  ])('rejects an unknown cameraMode %s', (_label, cameraMode) => {
    expect(
      validateOpenConfig({
        ...validConfig,
        cameraMode: [cameraMode],
      })
    ).toEqual({ ok: false, result: invalidResult });
  });

  it('rejects an unknown dataRetainedMode', () => {
    expect(
      validateOpenConfig({ ...validConfig, dataRetainedMode: 'append' })
    ).toEqual({ ok: false, result: invalidResult });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    'rejects invalid quality %p',
    (quality) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          cameraMode: [{ mode: 'single', quality }],
        })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0, -1])(
    'rejects invalid recTime %p',
    (recTime) => {
      expect(
        validateOpenConfig({
          ...validConfig,
          cameraMode: [{ mode: 'video', recTime }],
        })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'rejects invalid videoBitRate %p',
    (videoBitRate) => {
      expect(validateOpenConfig({ ...validConfig, videoBitRate })).toEqual({
        ok: false,
        result: invalidResult,
      });
    }
  );

  it.each([
    ['non-object watermark', 'stamp'],
    ['array watermark', []],
    ['missing content', { position: 'top-left' }],
    ['non-array content', { content: 'stamp' }],
    ['non-string content item', { content: ['stamp', 1] }],
    ['unknown position', { content: ['stamp'], position: 'center' }],
  ])('rejects %s', (_label, watermark) => {
    expect(validateOpenConfig({ ...validConfig, watermark })).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it.each(['fast', false, 1])(
    'rejects invalid photoQualityPrioritization %p',
    (photoQualityPrioritization) => {
      expect(
        validateOpenConfig({ ...validConfig, photoQualityPrioritization })
      ).toEqual({ ok: false, result: invalidResult });
    }
  );

  it.each(['true', 1, null])('rejects invalid photoHDR %p', (photoHDR) => {
    expect(validateOpenConfig({ ...validConfig, photoHDR })).toEqual({
      ok: false,
      result: invalidResult,
    });
  });

  it('accepts valid boundary values and empty watermark content', () => {
    const config = {
      cameraMode: [
        {
          mode: 'single' as const,
          type: 'front' as const,
          flashMode: 'auto' as const,
          quality: 0,
          recTime: Number.MIN_VALUE,
        },
        {
          mode: 'video' as const,
          type: 'back' as const,
          flashMode: 'off' as const,
          quality: 1,
        },
      ],
      dataRetainedMode: 'retain' as const,
      watermark: {
        content: [],
        position: 'bottom-center' as const,
      },
      photoQualityPrioritization: 'quality' as const,
      photoHDR: false,
      videoBitRate: Number.MIN_VALUE,
    };

    expect(validateOpenConfig(config)).toEqual({ ok: true, config });
  });

  it('does not modify the input and returns a deep session snapshot', () => {
    const mode: {
      mode: 'single' | 'video';
      type: 'back';
      flashMode: 'on';
      quality: number;
      recTime: number;
    } = {
      mode: 'single',
      type: 'back' as const,
      flashMode: 'on' as const,
      quality: 0.8,
      recTime: 5,
    };
    const content = ['title', 'body'];
    const watermark: {
      content: string[];
      position: 'top-right' | 'bottom-left';
    } = {
      content,
      position: 'top-right',
    };
    const cameraMode = [mode];
    const config = {
      cameraMode,
      dataRetainedMode: 'clear' as const,
      watermark,
      photoQualityPrioritization: 'balanced' as const,
      photoHDR: true,
      videoBitRate: 20_000_000,
    };
    const before = JSON.parse(JSON.stringify(config));

    const validated = validateOpenConfig(config);

    expect(config).toEqual(before);
    expect(validated).toEqual({ ok: true, config });
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('expected valid config');
    expect(validated.config).not.toBe(config);
    expect(validated.config.cameraMode).not.toBe(cameraMode);
    expect(validated.config.cameraMode[0]).not.toBe(mode);
    expect(validated.config.watermark).not.toBe(watermark);
    expect(validated.config.watermark?.content).not.toBe(content);

    cameraMode.push({ ...mode, mode: 'video' });
    mode.mode = 'video';
    watermark.position = 'bottom-left';
    content.push('late mutation');

    expect(validated.config).toEqual(before);
  });
});
