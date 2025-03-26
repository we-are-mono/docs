import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  redirects: async () => [
    {
      source: "/",
      destination: "/gateway",
      permanent: true,
    }
  ]
};

export default withMDX(config);
