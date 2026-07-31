import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { WatermarkStamp } from '../../../camera/watermark/WatermarkStamp';

const frame = { x: 12, y: 20, width: 300, height: 400 };

beforeEach(() => {
  jest.clearAllMocks();
});

it('使用显式 frame 渲染透明 Skia Canvas + Paragraph，不再渲染 RN Text', () => {
  const { getByTestId, queryByText } = renderDark(
    <WatermarkStamp
      frame={frame}
      watermark={{ content: ['L1', 'L2'], position: 'top-right' }}
    />
  );

  expect(
    StyleSheet.flatten(getByTestId('watermark-stamp').props.style)
  ).toEqual(
    expect.objectContaining({
      position: 'absolute',
      left: 12,
      top: 20,
      width: 300,
      height: 400,
    })
  );
  expect(getByTestId('watermark-canvas').props.opaque).toBe(false);
  expect(queryByText('L1')).toBeNull();
  expect(queryByText('L2')).toBeNull();
});

it('effect cleanup dispose Paragraph 与 Builder', () => {
  const skia = require('@shopify/react-native-skia');
  const rendered = renderDark(
    <WatermarkStamp frame={frame} watermark={{ content: ['x'] }} />
  );
  const builder = skia.Skia.ParagraphBuilder.Make.mock.results.at(-1).value;
  const paragraph = builder.build.mock.results[0].value;

  rendered.unmount();

  expect(paragraph.dispose).toHaveBeenCalledTimes(1);
  expect(builder.dispose).toHaveBeenCalledTimes(1);
});

it('兼容未传 frame：先由父容器 layout 得到实际 frame，不读取 window width', () => {
  const skia = require('@shopify/react-native-skia');
  const { getByTestId } = renderDark(
    <WatermarkStamp watermark={{ content: ['x'] }} />
  );
  const root = getByTestId('watermark-stamp');

  fireEvent(root, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 240, height: 320 } },
  });

  expect(skia.Skia.ParagraphBuilder.Make).toHaveBeenCalledTimes(1);
});
