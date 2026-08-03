import {
  buildBasicConfig,
  buildMultiModeConfig,
  buildQualityConfig,
  buildWatermarkConfig,
} from '../../../example/src/domain/scenarioConfigs';

const fixedNow = new Date('2026-08-03T10:20:30.000Z');

it('基础照片只生成照片 mode 字段', () => {
  expect(
    buildBasicConfig({
      mode: 'single',
      type: 'back',
      flashMode: 'auto',
      quality: 0.9,
      recTime: 15,
    })
  ).toEqual({
    cameraMode: [
      { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
    ],
    dataRetainedMode: 'clear',
  });
});

it('基础录像只生成录像 mode 字段', () => {
  expect(
    buildBasicConfig({
      mode: 'video',
      type: 'front',
      flashMode: 'off',
      quality: 0.8,
      recTime: 30,
    })
  ).toEqual({
    cameraMode: [
      { mode: 'video', type: 'front', flashMode: 'off', recTime: 30 },
    ],
    dataRetainedMode: 'clear',
  });
});

it('多模式使用固定公开配置并透传 retained mode', () => {
  expect(buildMultiModeConfig('retain')).toEqual({
    cameraMode: [
      { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
      { mode: 'continuous', quality: 0.9 },
      { mode: 'video', recTime: 15 },
    ],
    dataRetainedMode: 'retain',
  });
});

it('水印 trim 输入并使用注入时间生成可见内容', () => {
  expect(
    buildWatermarkConfig(
      {
        title: '  巡检记录  ',
        location: '  A 区  ',
        note: '  门锁完好  ',
        position: 'bottom-right',
      },
      fixedNow
    )
  ).toEqual({
    ok: true,
    config: {
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
      watermark: {
        content: [
          '巡检记录',
          '拍摄时间：2026-08-03T10:20:30.000Z',
          '地点：A 区',
          '备注：门锁完好',
        ],
        position: 'bottom-right',
      },
    },
  });
});

it('水印移除 trim 后的空地点与备注并默认 top-right', () => {
  expect(
    buildWatermarkConfig(
      {
        title: '  设备复核  ',
        location: '   ',
        note: '\n\t',
      },
      fixedNow
    )
  ).toEqual({
    ok: true,
    config: {
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
      watermark: {
        content: ['设备复核', '拍摄时间：2026-08-03T10:20:30.000Z'],
        position: 'top-right',
      },
    },
  });
});

it('水印标题 trim 后为空时返回 title field error', () => {
  expect(
    buildWatermarkConfig(
      {
        title: ' \n ',
        location: 'A 区',
        note: '门锁完好',
      },
      fixedNow
    )
  ).toEqual({
    ok: false,
    fieldError: {
      field: 'title',
      message: '请输入记录标题',
    },
  });
});

it('照片质量配置只生成显式照片偏好', () => {
  expect(
    buildQualityConfig({
      kind: 'photo',
      quality: 0.85,
      prioritization: 'quality',
      hdr: 'on',
    })
  ).toEqual({
    cameraMode: [{ mode: 'single', quality: 0.85 }],
    dataRetainedMode: 'clear',
    photoQualityPrioritization: 'quality',
    photoHDR: true,
  });
});

it('照片 SDK 默认完全省略可选 key', () => {
  const config = buildQualityConfig({
    kind: 'photo',
    quality: 0.9,
    prioritization: 'sdk-default',
    hdr: 'sdk-default',
  });

  expect(config).toEqual({
    cameraMode: [{ mode: 'single', quality: 0.9 }],
    dataRetainedMode: 'clear',
  });
  expect(Object.hasOwn(config, 'photoQualityPrioritization')).toBe(false);
  expect(Object.hasOwn(config, 'photoHDR')).toBe(false);
  expect(Object.hasOwn(config, 'videoBitRate')).toBe(false);
});

it('录像质量配置只生成显式 bitrate', () => {
  expect(
    buildQualityConfig({
      kind: 'video',
      recTime: 45,
      videoBitRate: 24_000_000,
    })
  ).toEqual({
    cameraMode: [{ mode: 'video', recTime: 45 }],
    dataRetainedMode: 'clear',
    videoBitRate: 24_000_000,
  });
});

it('录像 SDK 默认完全省略 bitrate 与照片专用 key', () => {
  const config = buildQualityConfig({
    kind: 'video',
    recTime: 15,
    videoBitRate: null,
  });

  expect(config).toEqual({
    cameraMode: [{ mode: 'video', recTime: 15 }],
    dataRetainedMode: 'clear',
  });
  expect(Object.hasOwn(config, 'videoBitRate')).toBe(false);
  expect(Object.hasOwn(config, 'photoQualityPrioritization')).toBe(false);
  expect(Object.hasOwn(config, 'photoHDR')).toBe(false);
});

it('每次调用都返回新的对象、数组与 mode/watermark 内容', () => {
  const basicA = buildBasicConfig({
    mode: 'single',
    type: 'back',
    flashMode: 'auto',
    quality: 0.9,
    recTime: 15,
  });
  const basicB = buildBasicConfig({
    mode: 'single',
    type: 'back',
    flashMode: 'auto',
    quality: 0.9,
    recTime: 15,
  });
  const multiA = buildMultiModeConfig('clear');
  const multiB = buildMultiModeConfig('clear');
  const watermarkA = buildWatermarkConfig(
    { title: '记录', location: '', note: '' },
    fixedNow
  );
  const watermarkB = buildWatermarkConfig(
    { title: '记录', location: '', note: '' },
    fixedNow
  );
  const qualityA = buildQualityConfig({
    kind: 'video',
    recTime: 15,
    videoBitRate: null,
  });
  const qualityB = buildQualityConfig({
    kind: 'video',
    recTime: 15,
    videoBitRate: null,
  });

  expect(basicA).not.toBe(basicB);
  expect(basicA.cameraMode).not.toBe(basicB.cameraMode);
  expect(basicA.cameraMode[0]).not.toBe(basicB.cameraMode[0]);
  expect(multiA).not.toBe(multiB);
  expect(multiA.cameraMode).not.toBe(multiB.cameraMode);
  expect(multiA.cameraMode[0]).not.toBe(multiB.cameraMode[0]);
  expect(qualityA).not.toBe(qualityB);
  expect(qualityA.cameraMode).not.toBe(qualityB.cameraMode);
  expect(qualityA.cameraMode[0]).not.toBe(qualityB.cameraMode[0]);

  expect(watermarkA.ok).toBe(true);
  expect(watermarkB.ok).toBe(true);
  if (watermarkA.ok && watermarkB.ok) {
    expect(watermarkA.config).not.toBe(watermarkB.config);
    expect(watermarkA.config.cameraMode).not.toBe(watermarkB.config.cameraMode);
    expect(watermarkA.config.watermark).not.toBe(watermarkB.config.watermark);
    expect(watermarkA.config.watermark?.content).not.toBe(
      watermarkB.config.watermark?.content
    );
  }
});
