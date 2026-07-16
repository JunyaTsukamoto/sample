/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // data/ JSON をランタイムで読むため、ファイルトレースに含める
  outputFileTracingIncludes: {
    '/api/**': ['./data/**/*'],
  },
};
module.exports = nextConfig;
