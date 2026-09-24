import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';

export function FormField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A7565"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function ActionButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  loading,
  secondary = false,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? '#593420' : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: '#4A2B1A', fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCC9B8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#4A2B1A',
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    backgroundColor: '#A95514',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: { backgroundColor: '#F4E8DC' },
  secondaryText: { color: '#593420' },
  disabled: { opacity: 0.6 },
});
