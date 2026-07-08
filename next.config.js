/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'pg',
    '@stacks/transactions',
    '@stacks/network',
    'groq-sdk',
  ],
};

module.exports = nextConfig;
