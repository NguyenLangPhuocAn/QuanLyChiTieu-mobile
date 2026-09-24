import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Tag } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { resolveCategoryIconUrls } from '../utils/categoryIcons';

type CategoryIconProps = {
  icon?: string | null;
  size?: number;
};

const IconImage = ({ icon, size = 20 }: CategoryIconProps) => {
  const urls = resolveCategoryIconUrls(icon);
  const [index, setIndex] = useState(0);
  const iconUrl = urls[index];
  if (!iconUrl) {
    return <Tag size={size} color={Colors.primary} />;
  }

  return (
    <Image
      key={iconUrl}
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
      onError={() =>
        setIndex(current => (current === index ? current + 1 : current))
      }
    />
  );
};

const CategoryIcon = (props: CategoryIconProps) => (
  <IconImage key={props.icon ?? ''} {...props} />
);

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent',
  },
});

export default CategoryIcon;
