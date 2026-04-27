/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Next 15.5+: experimental.typedRoutes 는 typedRoutes 로 이동
  typedRoutes: true,
};

export default nextConfig;
