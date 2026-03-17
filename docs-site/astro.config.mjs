import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://mabulu-inc.github.io',
  base: '/simplicity-admin',
  integrations: [
    starlight({
      title: 'SIMPLICITY-ADMIN',
      tagline: 'Production-grade admin suite from your database',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/mabulu-inc/simplicity-admin',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Configuration', slug: 'getting-started/configuration' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Architecture', slug: 'core-concepts/architecture' },
            { label: 'Schema-as-Truth', slug: 'core-concepts/schema-as-truth' },
            { label: 'RBAC', slug: 'core-concepts/rbac' },
          ],
        },
        {
          label: 'Packages',
          items: [
            { label: 'core', slug: 'packages/core' },
            { label: 'db', slug: 'packages/db' },
            { label: 'auth', slug: 'packages/auth' },
            { label: 'api', slug: 'packages/api' },
            { label: 'ui', slug: 'packages/ui' },
            { label: 'cli', slug: 'packages/cli' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Adding a Table', slug: 'guides/adding-a-table' },
            { label: 'Customizing Auth', slug: 'guides/customizing-auth' },
            { label: 'Writing Plugins', slug: 'guides/writing-plugins' },
            { label: 'Embedding in Express/Fastify', slug: 'guides/embedding' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Config Options', slug: 'reference/config-options' },
            { label: 'CLI Commands', slug: 'reference/cli-commands' },
            { label: 'Environment Variables', slug: 'reference/environment-variables' },
            { label: 'System Schema', slug: 'reference/system-schema' },
          ],
        },
      ],
    }),
  ],
});
