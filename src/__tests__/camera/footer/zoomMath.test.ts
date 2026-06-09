import {
  clamp,
  displayToProgress,
  progressToDisplay,
  progressToVzf,
} from '../../../camera/footer/zoomMath';

// 标准后置 dual 参数:超广角 0.5x→10x,displayMul=0.5(vzf=display/0.5)。
const MIN_DISPLAY = 0.5;
const MAX_DISPLAY = 10;
const DISPLAY_MUL = 0.5;
const DEV_MIN = 1; // vzf:超广角 minZoom=1 → display 0.5x
const DEV_MAX = 20; // vzf:10x / 0.5 = 20

describe('clamp', () => {
  test('夹在 [lo,hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('progressToDisplay (对数插值)', () => {
  test('t=0 → minDisplay', () => {
    expect(progressToDisplay(0, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(0.5, 6);
  });
  test('t=1 → maxDisplay', () => {
    expect(progressToDisplay(1, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(10, 6);
  });
  test('中点对数 → 几何中值 sqrt(min·max)', () => {
    // 对数曲线中点 = min·(max/min)^0.5 = sqrt(0.5·10) = sqrt(5) ≈ 2.236(非线性中值 5.25)
    expect(progressToDisplay(0.5, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(
      Math.sqrt(MIN_DISPLAY * MAX_DISPLAY),
      6
    );
  });
  test('clamp:t<0/t>1 落到端点', () => {
    expect(progressToDisplay(-0.5, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(
      0.5,
      6
    );
    expect(progressToDisplay(2, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(10, 6);
  });
});

describe('displayToProgress (progressToDisplay 的逆)', () => {
  test('端点 0/1', () => {
    expect(displayToProgress(0.5, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(0, 6);
    expect(displayToProgress(10, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(1, 6);
  });
  test('与 progressToDisplay 互逆', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const d = progressToDisplay(t, MIN_DISPLAY, MAX_DISPLAY);
      expect(displayToProgress(d, MIN_DISPLAY, MAX_DISPLAY)).toBeCloseTo(t, 6);
    }
  });
});

describe('progressToVzf (进度→受控 vzf)', () => {
  test('t=0 → vzf=1.0(用户 0.5x)', () => {
    expect(
      progressToVzf(0, MIN_DISPLAY, MAX_DISPLAY, DISPLAY_MUL, DEV_MIN, DEV_MAX)
    ).toBeCloseTo(1.0, 6);
  });
  test('t=1 → vzf=20(用户 10x)', () => {
    expect(
      progressToVzf(1, MIN_DISPLAY, MAX_DISPLAY, DISPLAY_MUL, DEV_MIN, DEV_MAX)
    ).toBeCloseTo(20, 6);
  });
  test('中点 → vzf = sqrt(5)/0.5 ≈ 4.472(对数,非线性)', () => {
    const expected = Math.sqrt(MIN_DISPLAY * MAX_DISPLAY) / DISPLAY_MUL;
    expect(
      progressToVzf(
        0.5,
        MIN_DISPLAY,
        MAX_DISPLAY,
        DISPLAY_MUL,
        DEV_MIN,
        DEV_MAX
      )
    ).toBeCloseTo(expected, 6);
  });
  test('单调递增:t 增大 vzf 增大', () => {
    let prev = -Infinity;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const v = progressToVzf(
        t,
        MIN_DISPLAY,
        MAX_DISPLAY,
        DISPLAY_MUL,
        DEV_MIN,
        DEV_MAX
      );
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
  test('软上限:deviceMaxZoom 远大于软上限 vzf 时,clamp 到软上限 vzf(=maxDisplay/mul=20)', () => {
    // 设备 vzf 可达 246(123x 多镜头),但软上限对应 vzf=20,t=1 仍落 20。
    expect(
      progressToVzf(1, MIN_DISPLAY, MAX_DISPLAY, DISPLAY_MUL, DEV_MIN, 246)
    ).toBeCloseTo(20, 6);
  });
  test('下限:t<0 clamp 到 deviceMinZoom', () => {
    expect(
      progressToVzf(-1, MIN_DISPLAY, MAX_DISPLAY, DISPLAY_MUL, DEV_MIN, DEV_MAX)
    ).toBeCloseTo(DEV_MIN, 6);
  });
  test('无超广角(displayMul=1,min=max=1 设备只有广角):范围退化仍合法', () => {
    // 单广角:minDisplay=1, maxDisplay=min(8,10)=8, mul=1, devMin=1, devMax=8
    expect(progressToVzf(0, 1, 8, 1, 1, 8)).toBeCloseTo(1, 6);
    expect(progressToVzf(1, 1, 8, 1, 1, 8)).toBeCloseTo(8, 6);
  });
});
