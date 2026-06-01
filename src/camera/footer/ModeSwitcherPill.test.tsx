import { render, fireEvent } from '@testing-library/react-native';
import { ModeSwitcherPill } from './ModeSwitcherPill';

const items = [
  { key: 'continuous', label: '连拍' },
  { key: 'single', label: '单拍' },
  { key: 'video', label: '视频' },
];

it('selects by tap', () => {
  const onSelect = jest.fn();
  const { getByTestId } = render(
    <ModeSwitcherPill items={items} currentIndex={1} onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('mode-pill-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('single item shows label only (no pill)', () => {
  const { queryByTestId, getByText } = render(
    <ModeSwitcherPill
      items={[{ key: 'single', label: '单拍' }]}
      currentIndex={0}
      onSelect={() => {}}
    />
  );
  expect(queryByTestId('mode-pill-0')).toBeNull();
  expect(getByText('单拍')).toBeTruthy();
});
