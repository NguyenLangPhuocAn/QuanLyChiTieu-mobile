module.exports = {
  DocumentDirectoryPath: '/tmp',
  DownloadDirectoryPath: '/tmp',
  mkdir: jest.fn(() => Promise.resolve()),
  exists: jest.fn(() => Promise.resolve(false)),
  unlink: jest.fn(() => Promise.resolve()),
  hash: jest.fn(() => Promise.resolve('A'.repeat(64))),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({ statusCode: 200, bytesWritten: 1 }),
  })),
  writeFile: jest.fn(() => Promise.resolve()),
};
