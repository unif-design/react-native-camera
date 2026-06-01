import { render, fireEvent } from '@testing-library/react-native';
import { ActionRow } from './ActionRow';

const base = {
  mode: 'single' as const,
  recording: false,
  latestUri: undefined,
  count: 0,
  onShutter: jest.fn(),
  onBack: jest.fn(),
  onSave: jest.fn(),
  onFlip: jest.fn(),
  onOpenPreview: jest.fn(),
};

it('wires shutter/back/save/flip', () => {
  const p = {
    ...base,
    onShutter: jest.fn(),
    onBack: jest.fn(),
    onSave: jest.fn(),
    onFlip: jest.fn(),
  };
  const { getByTestId } = render(<ActionRow {...p} />);
  fireEvent.press(getByTestId('shutter-btn'));
  expect(p.onShutter).toHaveBeenCalled();
  fireEvent.press(getByTestId('back-btn'));
  expect(p.onBack).toHaveBeenCalled();
  fireEvent.press(getByTestId('save-btn'));
  expect(p.onSave).toHaveBeenCalled();
  fireEvent.press(getByTestId('flip-btn'));
  expect(p.onFlip).toHaveBeenCalled();
});

it('recording hides back/save/flip/thumb', () => {
  const { queryByTestId, getByTestId } = render(
    <ActionRow {...base} recording />
  );
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
  expect(queryByTestId('flip-btn')).toBeNull();
  expect(queryByTestId('thumbnail-stack')).toBeNull();
});
