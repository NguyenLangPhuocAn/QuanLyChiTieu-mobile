const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
const NETWORK_ERROR_MESSAGE =
  'Không thể kết nối hệ thống. Vui lòng kiểm tra mạng hoặc thử lại sau.';
const SERVER_ERROR_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
const INVALID_INPUT_MESSAGE = 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.';

export const getUserFriendlyErrorMessage = (
  error: unknown,
  fallback = GENERIC_ERROR_MESSAGE,
) => {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.trim();

  if (!message) {
    return fallback;
  }

  if (/jwt|token|bearer|unauthorized|forbidden|\b401\b|\b403\b/i.test(message)) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (
    /network request failed|failed to fetch|abort|timeout|econn|enotfound|socket|networkerror/i.test(
      message,
    )
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    /internal server|prisma|sql|database|exception|stack trace|\b500\b|cannot read|undefined|null|nan|\[object object\]|is not a function|request failed/i.test(
      message,
    )
  ) {
    return SERVER_ERROR_MESSAGE;
  }

  if (/must be|should not|property .* should|constraint|validation failed/i.test(message)) {
    return INVALID_INPUT_MESSAGE;
  }

  return message;
};
