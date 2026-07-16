// 本番ビルドで USE_MOCK_DATA=true の場合はビルドを失敗させる (spec §19)
const useMock = String(process.env.USE_MOCK_DATA || 'false').toLowerCase() === 'true';
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (useMock && isProd) {
  console.error('\n[ビルド中断] 本番環境で USE_MOCK_DATA=true が設定されています。');
  console.error('本番ではモックデータを使用できません。USE_MOCK_DATA=false にしてください。(spec §19)\n');
  process.exit(1);
}
console.log('[guard-mock] OK (USE_MOCK_DATA=%s, NODE_ENV=%s)', useMock, process.env.NODE_ENV || 'undefined');
