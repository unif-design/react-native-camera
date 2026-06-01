import { render } from '@testing-library/react-native';
import { VolumeIcon } from './VolumeIcon';

it('renders without crashing (on/off)', () => {
  expect(() => render(<VolumeIcon on size={20} color="#fff" />)).not.toThrow();
  expect(() =>
    render(<VolumeIcon on={false} size={20} color="#fff" />)
  ).not.toThrow();
});
