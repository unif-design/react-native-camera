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

it('基础配置每次调用都返回新的对象、数组与 mode', () => {
  const input = {
    mode: 'single',
    type: 'back',
    flashMode: 'auto',
    quality: 0.9,
    recTime: 15,
  } as const;
  const basicA = buildBasicConfig(input);
  const basicB = buildBasicConfig(input);

  expect(basicA).not.toBe(basicB);
  expect(basicA.cameraMode).not.toBe(basicB.cameraMode);
  expect(basicA.cameraMode[0]).not.toBe(basicB.cameraMode[0]);
});

it('多模式配置每次调用都返回新的数组与全部 mode', () => {
  const multiA = buildMultiModeConfig('clear');
  const multiB = buildMultiModeConfig('clear');

  expect(multiA).not.toBe(multiB);
  expect(multiA.cameraMode).not.toBe(multiB.cameraMode);
  expect(multiA.cameraMode[0]).not.toBe(multiB.cameraMode[0]);
  expect(multiA.cameraMode[1]).not.toBe(multiB.cameraMode[1]);
  expect(multiA.cameraMode[2]).not.toBe(multiB.cameraMode[2]);
});

it('水印配置每次调用都返回新的全部可变嵌套值', () => {
  const watermarkA = buildWatermarkConfig(
    { title: '记录', location: '', note: '' },
    fixedNow
  );
  const watermarkB = buildWatermarkConfig(
    { title: '记录', location: '', note: '' },
    fixedNow
  );

  if (!watermarkA.ok || !watermarkB.ok) {
    throw new Error('测试 fixture 应生成有效水印配置');
  }

  expect(watermarkA).not.toBe(watermarkB);
  expect(watermarkA.config).not.toBe(watermarkB.config);
  expect(watermarkA.config.cameraMode).not.toBe(watermarkB.config.cameraMode);
  expect(watermarkA.config.cameraMode[0]).not.toBe(
    watermarkB.config.cameraMode[0]
  );
  expect(watermarkA.config.watermark).not.toBe(watermarkB.config.watermark);
  expect(watermarkA.config.watermark?.content).not.toBe(
    watermarkB.config.watermark?.content
  );
});

it('照片与录像质量配置每次调用都返回新的数组与 mode', () => {
  const photoInput = {
    kind: 'photo',
    quality: 0.85,
    prioritization: 'balanced',
    hdr: 'off',
  } as const;
  const videoInput = {
    kind: 'video',
    recTime: 15,
    videoBitRate: null,
  } as const;
  const photoA = buildQualityConfig(photoInput);
  const photoB = buildQualityConfig(photoInput);
  const videoA = buildQualityConfig(videoInput);
  const videoB = buildQualityConfig(videoInput);

  expect(photoA).not.toBe(photoB);
  expect(photoA.cameraMode).not.toBe(photoB.cameraMode);
  expect(photoA.cameraMode[0]).not.toBe(photoB.cameraMode[0]);
  expect(videoA).not.toBe(videoB);
  expect(videoA.cameraMode).not.toBe(videoB.cameraMode);
  expect(videoA.cameraMode[0]).not.toBe(videoB.cameraMode[0]);
});
