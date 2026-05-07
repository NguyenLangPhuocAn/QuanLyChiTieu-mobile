import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { Tag } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { resolveCategoryIconUrl } from '../utils/categoryIcons';

type CategoryIconProps = {
  icon?: string | null;
  size?: number;
};

const CategoryIcon = ({ icon, size = 20 }: CategoryIconProps) => {
  const iconUrl = resolveCategoryIconUrl(icon);

  if (!iconUrl) {
    return <Tag size={size} color={Colors.primary} />;
  }

  return (
    <Image
      source={{ uri: iconUrl }}
      style={[
        styles.image,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
        },
      ]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent',
  },
});

export default CategoryIcon;
