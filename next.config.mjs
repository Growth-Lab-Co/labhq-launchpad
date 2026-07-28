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
      // Payment consolidated to /pricing - Next.js redirects append any
      // incoming query string (?plan=, ?vertical=, ?billing=) onto a
      // destination that has none of its own, so this alone preserves
      // state from old bookmarked/shared /get-started links.
      // /get-started/success (the Stripe return URL) is a different route
      // entirely and is untouched by this exact-path redirect.
      {
        source: "/get-started",
        destination: "/pricing",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
