import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

// 只替换 Design native 实现，保留屏幕与 controller 的真实行为边界。
type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type SegmentedProps = {
  value: string;
  onChange: (id: string) => void;
  items: readonly { id: string; label: string }[];
  disabled?: boolean;
};

type FieldProps = TextInputProps & {
  error?: string;
  disabled?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: unknown;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
};

export function Button({ label, onPress, disabled, loading }: ButtonProps) {
  const unavailable = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}

export function EntryCard({
  title,
  sub,
  onPress,
}: {
  title: string;
  sub?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? title : undefined}
      onPress={onPress}
    >
      <Text>{title}</Text>
      {sub ? <Text>{sub}</Text> : null}
    </Pressable>
  );
}

export function NavBar({
  title,
  left,
}: {
  title: string;
  left?: {
    onPress: () => void;
    accessibilityLabel?: string;
  };
}) {
  return (
    <View>
      {left ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={left.accessibilityLabel}
          onPress={left.onPress}
        />
      ) : null}
      <Text>{title}</Text>
    </View>
  );
}

export function Segmented({
  value,
  onChange,
  items,
  disabled,
}: SegmentedProps) {
  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{
            selected: item.id === value,
            disabled: Boolean(disabled),
          }}
          disabled={disabled}
          onPress={() => onChange(item.id)}
        >
          <Text>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({
  error,
  disabled,
  leading: _leading,
  trailing: _trailing,
  containerStyle: _containerStyle,
  height: _height,
  minHeight: _minHeight,
  maxHeight: _maxHeight,
  ...props
}: FieldProps) {
  return (
    <View>
      <TextInput {...props} editable={!disabled && props.editable !== false} />
      {error ? <Text>{error}</Text> : null}
    </View>
  );
}

export const Input = Field;
export const Textarea = Field;

export function Switch({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onChange(!value)}
    />
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="减少"
        disabled={disabled || value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <Text>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="增加"
        disabled={disabled || value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

export function Icon({
  testID,
}: {
  name: string;
  testID?: string;
  size?: number;
  color?: string;
}) {
  return <View testID={testID} />;
}

export function Tag({ label, variant }: { label: string; variant?: string }) {
  return <Text testID={variant ? `tag-${variant}` : undefined}>{label}</Text>;
}

export function ThemeProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export const fw = {
  regular: '400',
  medium: '500',
  semi: '600',
};

export const r = (value: number) => value;
export const rf = (value: number) => value;
export const useColors = () =>
  new Proxy<Record<string, string>>({}, { get: () => 'transparent' });
export const useThemedStyles = (
  maker: (colors: object, shadow: object) => object
) => maker(new Proxy({}, { get: () => 'transparent' }), {});
