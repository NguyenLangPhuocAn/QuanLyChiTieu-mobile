import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';

type Props = { name: string; onRemove?: () => void; disabled?: boolean };

export default function HashtagChip({ name, onRemove, disabled }: Props) {
  const content = (
    <>
      <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
        #{name}
      </Text>
      {onRemove ? <X size={12} color="#A94F18" /> : null}
    </>
  );
  return onRemove ? (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Bỏ hashtag ${name}`}
      disabled={disabled}
      onPress={onRemove}
      style={styles.chip}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={styles.chip}>{content}</View>
  );
}

const styles = StyleSheet.create({
  chip: {
    maxWidth: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFE3C8',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  text: {
    flexShrink: 1,
    color: '#A94F18',
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontWeight: '600',
  },
});
