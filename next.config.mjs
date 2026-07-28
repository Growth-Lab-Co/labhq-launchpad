/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/miia-for-allied-health",
        destination: "/allied-health",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
