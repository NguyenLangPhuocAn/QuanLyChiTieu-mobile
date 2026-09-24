const fs = require('node:fs');
const path = require('node:path');

function configuration(args) {
  if (args.length === 1 && args[0] === '--local') return { mode: 'local', remoteBaseUrl: '' };
  if (args.length !== 2 || args[0] !== '--remote') throw new Error('Dùng --local hoặc --remote https://dia-chi-backend');
  let url;
  try { url = new URL(args[1]); } catch { throw new Error('URL backend chưa hợp lệ.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('URL từ xa phải dùng HTTPS và không chứa thông tin đăng nhập, query hoặc fragment.');
  }
  return { mode: 'remote', remoteBaseUrl: url.toString().replace(/\/+$/, '') };
}

if (require.main === module) {
  try {
    const config = configuration(process.argv.slice(2));
    fs.writeFileSync(path.resolve(__dirname, '../src/config/api.config.json'), JSON.stringify(config, null, 2) + '\n');
    console.log(`Đã chọn API ${config.mode}. Cần build lại APK để cấu hình có hiệu lực trong bản cài.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { configuration };
