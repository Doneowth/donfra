/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Generate directory-style output (e.g. /coding/index.html) so requests to
  // `/coding` are served correctly without nginx path rewrites.
  trailingSlash: true,
};

module.exports = nextConfig;
