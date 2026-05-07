import React from 'react';
import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
};

const GoogleIcon = ({ size = 20 }: Props) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5Z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.4 4 24 4c-7.7 0-14.3 4.3-17.7 10.7Z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.8-2 13.2-5.2l-6.1-5.2C29 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.4-8l-6.5 5C9.4 39.5 16.1 44 24 44Z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5-6 6.6l6.1 5.2C39 36.5 44 31 44 24c0-1.3-.1-2.3-.4-3.5Z"
      />
    </Svg>
  );
};

export default GoogleIcon;
