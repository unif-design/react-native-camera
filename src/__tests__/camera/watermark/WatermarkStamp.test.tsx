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

it('等价 watermark 新对象保持同一语义快照，不重建或提前 dispose', () => {
  const skia = require('@shopify/react-native-skia');
  const rendered = renderDark(
    <WatermarkStamp
      frame={frame}
      watermark={{ content: ['标题', '正文'], position: 'bottom-right' }}
    />
  );
  const builder = skia.Skia.ParagraphBuilder.Make.mock.results[0].value;
  const paragraph = builder.build.mock.results[0].value;

  rendered.rerender(
    <WatermarkStamp
      frame={{ ...frame }}
      watermark={{ content: ['标题', '正文'], position: 'bottom-right' }}
    />
  );

  expect(skia.Skia.ParagraphBuilder.Make).toHaveBeenCalledTimes(1);
  expect(paragraph.dispose).not.toHaveBeenCalled();
  expect(builder.dispose).not.toHaveBeenCalled();
});

it('watermark 语义变化时替换 Paragraph，并只释放被替换的快照', () => {
  const skia = require('@shopify/react-native-skia');
  const rendered = renderDark(
    <WatermarkStamp frame={frame} watermark={{ content: ['旧水印'] }} />
  );
  const oldBuilder = skia.Skia.ParagraphBuilder.Make.mock.results[0].value;
  const oldParagraph = oldBuilder.build.mock.results[0].value;

  rendered.rerender(
    <WatermarkStamp frame={frame} watermark={{ content: ['新水印'] }} />
  );

  const newBuilder = skia.Skia.ParagraphBuilder.Make.mock.results[1].value;
  const newParagraph = newBuilder.build.mock.results[0].value;
  expect(skia.Skia.ParagraphBuilder.Make).toHaveBeenCalledTimes(2);
  expect(oldParagraph.dispose).toHaveBeenCalledTimes(1);
  expect(oldBuilder.dispose).toHaveBeenCalledTimes(1);
  expect(newParagraph.dispose).not.toHaveBeenCalled();
  expect(newBuilder.dispose).not.toHaveBeenCalled();
});

it('effect cleanup 的 dispose 抛错不冒泡，并继续尝试 Paragraph 与 Builder', () => {
  const skia = require('@shopify/react-native-skia');
  const paragraph = {
    layout: jest.fn(),
    paint: jest.fn(),
    getHeight: jest.fn(() => 120),
    dispose: jest.fn(() => {
      throw new Error('paragraph dispose failed');
    }),
  };
  const builder: Record<string, jest.Mock> = {};
  builder.pushStyle = jest.fn(() => builder);
  builder.addText = jest.fn(() => builder);
  builder.pop = jest.fn(() => builder);
  builder.build = jest.fn(() => paragraph);
  builder.dispose = jest.fn(() => {
    throw new Error('builder dispose failed');
  });
  skia.Skia.ParagraphBuilder.Make.mockReturnValueOnce(builder);
  const rendered = renderDark(
    <WatermarkStamp frame={frame} watermark={{ content: ['x'] }} />
  );

  expect(() => rendered.unmount()).not.toThrow();
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
