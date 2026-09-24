const fs = require('node:fs');
const path = require('node:path');

function healthUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('Địa chỉ backend chưa hợp lệ.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Địa chỉ backend phải dùng HTTP/HTTPS, không chứa tài khoản, query hoặc fragment.');
  }
  return `${url.toString().replace(/\/+$/, '')}/health`;
}

async function checkApi(baseUrl, fetcher = fetch, timeoutMs = 10000) {
  const url = healthUrl(baseUrl);
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  let payload;
  try {
    response = await fetcher(url, {
      method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal,
    });
    if (!response.ok) throw new Error(`Máy chủ trả HTTP ${response.status}. Kiểm tra backend và tunnel.`);
    try {
      payload = await response.json();
    } catch {
      if (signal.aborted) throw new Error('Hết thời gian chờ backend.');
      throw new Error('Phản hồi không phải JSON; URL có thể đang trả trang HTML/cảnh báo của tunnel.');
    }
  } catch (error) {
    if (signal.aborted) throw new Error('Hết thời gian chờ backend.');
    if (!response) throw new Error('Không kết nối được backend. Kiểm tra URL, tiến trình server, tunnel và mạng.');
    throw error;
  }
  if (payload?.status !== 'ok' || payload?.service !== 'quan-ly-chi-tieu') {
    throw new Error('URL trả lời nhưng không phải health endpoint của backend quản lý chi tiêu.');
  }
  return 'Backend đã trả lời đúng. Tiếp theo cần thử đăng nhập và đọc ví để kiểm tra database; kiểm tra từ điện thoại 4G để xác nhận truy cập từ xa.';
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--url')) {
      throw new Error('Dùng node scripts/check-api.cjs hoặc thêm --url https://dia-chi-backend');
    }
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/config/api.config.json'), 'utf8'));
    const baseUrl = args[1] || (config.mode === 'remote' ? config.remoteBaseUrl : 'http://127.0.0.1:3000');
    console.log(await checkApi(baseUrl));
  })().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { healthUrl, checkApi };
