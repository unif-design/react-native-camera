import { render, fireEvent } from '@testing-library/react-native';
import { SideRail } from './SideRail';

const base = {
  flash: 'off' as const,
  aspectRatio: '4:3' as const,
  sound: true,
  grid: false,
  onChangeFlash: jest.fn(),
  onChangeAspectRatio: jest.fn(),
  onToggleSound: jest.fn(),
  onToggleGrid: jest.fn(),
};

it('toggles aspect / sound / grid', () => {
  const p = {
    ...base,
    onChangeAspectRatio: jest.fn(),
    onToggleSound: jest.fn(),
    onToggleGrid: jest.fn(),
  };
  const { getByTestId } = render(<SideRail {...p} />);
  fireEvent.press(getByTestId('aspect-btn'));
  expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');
  fireEvent.press(getByTestId('sound-btn'));
  expect(p.onToggleSound).toHaveBeenCalled();
  fireEvent.press(getByTestId('grid-btn'));
  expect(p.onToggleGrid).toHaveBeenCalled();
});

it('flash dropdown selects a mode', () => {
  const p = { ...base, onChangeFlash: jest.fn() };
  const { getByTestId } = render(<SideRail {...p} />);
  fireEvent.press(getByTestId('flash-btn'));
  fireEvent.press(getByTestId('flash-opt-on'));
  expect(p.onChangeFlash).toHaveBeenCalledWith('on');
});
