import { apiRequest } from '../src/services/api';
import { notificationsService } from '../src/services/notifications';
import type { NotificationSettings } from '../src/types/notification';

jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('notificationsService', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('gets unread notification count', () => {
    notificationsService.getUnreadCount('token-123');

    expect(mockedApiRequest).toHaveBeenCalledWith('/notifications/unread-count', {
      method: 'GET',
      token: 'token-123',
    });
  });

  it('updates notification settings', () => {
    const payload: Partial<NotificationSettings> = {
      budget_alerts_enabled: false,
      budget_expiring_enabled: true,
      system_notifications_enabled: true,
    };

    notificationsService.updateSettings('token-123', payload);

    expect(mockedApiRequest).toHaveBeenCalledWith('/notifications/settings', {
      method: 'PUT',
      token: 'token-123',
      body: payload,
    });
  });
});
