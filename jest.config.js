module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/asyncStorageMock.js',
    '^@react-native-google-signin/google-signin$': '<rootDir>/__mocks__/googleSigninMock.js',
    '^react-native-image-picker$': '<rootDir>/__mocks__/imagePickerMock.js',
    '^react-native-fs$': '<rootDir>/__mocks__/reactNativeFsMock.js',
  },
};
