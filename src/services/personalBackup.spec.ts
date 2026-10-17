jest.mock('./api', () => ({
  apiRequest: jest.fn(),
  apiUploadRequest: jest.fn(),
}));

import { apiRequest, apiUploadRequest } from './api';
import { personalBackupService } from './personalBackup';

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
});
