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
  it('sends the password as a multipart field instead of a URL query', () => {
    const file = { uri: 'file:///backup', name: 'a.stcn-backup', type: 'x' };
    personalBackupService.preview('token', file, 'mat-khau-rat-manh');
    expect(apiUploadRequest).toHaveBeenCalledWith(
      '/personal-backup/preview',
      'token',
      file,
      'POST',
      120000,
      { password: 'mat-khau-rat-manh' },
    );
  });

  it('exports with a JSON body and restores only selected rows', () => {
    const file = { uri: 'file:///backup', name: 'a.stcn-backup', type: 'x' };
    personalBackupService.export('token', 'mat-khau-rat-manh');
    expect(apiRequest).toHaveBeenCalledWith('/personal-backup/export', {
      method: 'POST',
      token: 'token',
      body: { password: 'mat-khau-rat-manh' },
      timeoutMs: 120000,
    });
    personalBackupService.restore('token', file, 'mat-khau-rat-manh', [1, 3]);
    expect(apiUploadRequest).toHaveBeenLastCalledWith(
      '/personal-backup/restore?rows=1%2C3',
      'token',
      file,
      'POST',
      120000,
      { password: 'mat-khau-rat-manh' },
    );
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
