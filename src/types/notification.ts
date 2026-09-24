export type NotificationType =
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'BUDGET_EXPIRING'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AppNotification = {
  id: number;
  user_id: number;
  broadcast_id?: number | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  source_type?: string | null;
  source_id?: number | null;
  read_at?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
};

export type NotificationSettings = {
  id: number;
  user_id: number;
  budget_alerts_enabled: boolean | null;
  budget_expiring_enabled: boolean | null;
  cashflow_forecast_enabled: boolean | null;
  savings_plan_alerts_enabled: boolean | null;
  system_notifications_enabled: boolean | null;
};

export type PaginatedNotifications = {
  data: AppNotification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
