jest.mock('./api', () => ({
  apiRequest: jest.fn(),
  apiUploadRequest: jest.fn(),
}));

import { apiRequest, apiUploadRequest } from './api';
import {
  getVisibleReadyBackupRowNumbers,
  personalBackupService,
  type BackupPreviewRow,
} from './personalBackup';

describe('personalBackupService', () => {
  it('previews the ordinary file without a password field', () => {
    const file = { uri: 'file:///backup', name: 'a.stcn-backup', type: 'x' };
    personalBackupService.preview('token', file);
    expect(apiUploadRequest).toHaveBeenCalledWith(
      '/personal-backup/preview',
      'token',
      file,
      'POST',
      120000,
    );
  });

  it('exports without passwords and restores only selected rows with the preview checksum', () => {
    const file = { uri: 'file:///backup', name: 'a.stcn-backup', type: 'x' };
    personalBackupService.export('token');
    expect(apiRequest).toHaveBeenCalledWith('/personal-backup/export', {
      method: 'POST',
      token: 'token',
      timeoutMs: 120000,
    });
    personalBackupService.restore('token', file, [1, 3], 'a'.repeat(64));
    expect(apiUploadRequest).toHaveBeenLastCalledWith(
      '/personal-backup/restore?rows=1%2C3&fileHash=' + 'a'.repeat(64),
      'token',
      file,
      'POST',
      120000,
    );
  });

  it('rejects restore without a preview checksum before contacting the API', () => {
    jest.clearAllMocks();
    expect(() =>
      personalBackupService.restore(
        'token',
        { uri: 'file:///x', name: 'x', type: 'x' },
        [1],
        '',
      ),
    ).toThrow('xem trước');
    expect(apiUploadRequest).not.toHaveBeenCalled();
  });

  it('only selects ready rows that the user can currently review', () => {
    const rows = Array.from({ length: 205 }, (_, index) => ({
      row: index + 1,
      status: index === 1 ? 'DUPLICATE' : 'READY',
    })) as BackupPreviewRow[];

    const selected = getVisibleReadyBackupRowNumbers(rows, 200);

    expect(selected).toHaveLength(199);
    expect(selected).not.toContain(2);
    expect(selected).not.toContain(201);
    expect(selected[0]).toBe(1);
    expect(selected.at(-1)).toBe(200);
  });
});
