import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const ROOT = resolve(__dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('LICENSE', () => {
  it('exists at the repo root', () => {
    expect(existsSync(resolve(ROOT, 'LICENSE'))).toBe(true);
  });

  it('is BSL 1.1', () => {
    const license = readFile('LICENSE');
    expect(license).toContain('Business Source License 1.1');
  });

  it('names Mabulu Inc. as licensor', () => {
    const license = readFile('LICENSE');
    expect(license).toContain('Mabulu Inc.');
  });

  it('specifies Apache 2.0 as the change license', () => {
    const license = readFile('LICENSE');
    expect(license).toContain('Apache License, Version 2.0');
  });
});

describe('README.md', () => {
  let readme: string;

  it('exists at the repo root', () => {
    expect(existsSync(resolve(ROOT, 'README.md'))).toBe(true);
    readme = readFile('README.md');
  });

  it('includes a one-liner vision statement', () => {
    readme = readFile('README.md');
    // Should reference the core value prop: admin suite from a database
    expect(readme).toMatch(/admin/i);
    expect(readme).toMatch(/database/i);
  });

  it('includes quick start instructions', () => {
    readme = readFile('README.md');
    expect(readme).toContain('pnpm create @mabulu-inc/simplicity-admin');
    expect(readme).toContain('npm run dev');
  });

  it('includes feature highlights section', () => {
    readme = readFile('README.md');
    expect(readme).toMatch(/zero.config/i);
    expect(readme).toMatch(/RBAC/i);
    expect(readme).toMatch(/provider/i);
  });

  it('includes a package table with all six packages', () => {
    readme = readFile('README.md');
    const packages = ['core', 'db', 'auth', 'api', 'ui', 'cli'];
    for (const pkg of packages) {
      expect(readme).toContain(`@mabulu-inc/simplicity-admin-${pkg}`);
    }
  });

  it('links to the docs site', () => {
    readme = readFile('README.md');
    expect(readme).toContain('mabulu-inc.github.io/simplicity-admin');
  });

  it('includes development instructions', () => {
    readme = readFile('README.md');
    expect(readme).toContain('pnpm install');
    expect(readme).toContain('pnpm check');
  });

  it('includes license summary with link to LICENSE', () => {
    readme = readFile('README.md');
    expect(readme).toMatch(/BSL 1\.1|Business Source License/);
    expect(readme).toContain('LICENSE');
  });
});

describe('docs-site', () => {
  const docsDir = resolve(ROOT, 'docs-site');

  it('has a package.json', () => {
    expect(existsSync(resolve(docsDir, 'package.json'))).toBe(true);
  });

  it('has astro and starlight dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve(docsDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.astro).toBeDefined();
    expect(pkg.dependencies['@astrojs/starlight']).toBeDefined();
  });

  it('has an astro.config.mjs', () => {
    expect(existsSync(resolve(docsDir, 'astro.config.mjs'))).toBe(true);
  });

  it('has a tsconfig.json', () => {
    expect(existsSync(resolve(docsDir, 'tsconfig.json'))).toBe(true);
  });

  it('has a pnpm-lock.yaml', () => {
    expect(existsSync(resolve(docsDir, 'pnpm-lock.yaml'))).toBe(true);
  });

  it('configures base path as /simplicity-admin', () => {
    const config = readFileSync(resolve(docsDir, 'astro.config.mjs'), 'utf-8');
    expect(config).toContain("'/simplicity-admin'");
  });

  it('configures site URL for GitHub Pages', () => {
    const config = readFileSync(resolve(docsDir, 'astro.config.mjs'), 'utf-8');
    expect(config).toContain('mabulu-inc.github.io');
  });

  describe('content pages', () => {
    const contentDir = resolve(docsDir, 'src', 'content', 'docs');

    it('has Getting Started section', () => {
      expect(existsSync(resolve(contentDir, 'getting-started', 'introduction.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'getting-started', 'quick-start.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'getting-started', 'configuration.md'))).toBe(true);
    });

    it('has Core Concepts section', () => {
      expect(existsSync(resolve(contentDir, 'core-concepts', 'architecture.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'core-concepts', 'schema-as-truth.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'core-concepts', 'rbac.md'))).toBe(true);
    });

    it('has Packages section with all six packages', () => {
      const packages = ['core', 'db', 'auth', 'api', 'ui', 'cli'];
      for (const pkg of packages) {
        expect(existsSync(resolve(contentDir, 'packages', `${pkg}.md`))).toBe(true);
      }
    });

    it('has Guides section', () => {
      expect(existsSync(resolve(contentDir, 'guides', 'adding-a-table.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'guides', 'customizing-auth.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'guides', 'writing-plugins.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'guides', 'embedding.md'))).toBe(true);
    });

    it('has Reference section', () => {
      expect(existsSync(resolve(contentDir, 'reference', 'config-options.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'reference', 'cli-commands.md'))).toBe(true);
      expect(existsSync(resolve(contentDir, 'reference', 'environment-variables.md'))).toBe(true);
    });
  });

  describe('sidebar navigation', () => {
    it('covers all required sections', () => {
      const config = readFileSync(resolve(docsDir, 'astro.config.mjs'), 'utf-8');
      expect(config).toContain('Getting Started');
      expect(config).toContain('Core Concepts');
      expect(config).toContain('Packages');
      expect(config).toContain('Guides');
      expect(config).toContain('Reference');
    });
  });
});

describe('deploy-docs workflow (.github/workflows/deploy-docs.yml)', () => {
  const workflowPath = resolve(ROOT, '.github', 'workflows', 'deploy-docs.yml');

  it('exists', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it('parses as valid YAML', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    const workflow = parse(content);
    expect(workflow).toBeDefined();
    expect(workflow.name).toBeDefined();
  });

  it('triggers on pushes to main that touch docs-site/**', () => {
    const workflow = parse(readFileSync(workflowPath, 'utf-8'));
    const on = workflow.on;
    const push = on.push;
    expect(push.branches).toContain('main');
    expect(push.paths).toContain('docs-site/**');
  });

  it('uses actions/upload-pages-artifact and actions/deploy-pages', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('actions/upload-pages-artifact');
    expect(content).toContain('actions/deploy-pages');
  });

  it('has pages write and id-token write permissions', () => {
    const workflow = parse(readFileSync(workflowPath, 'utf-8'));
    const permissions = workflow.permissions;
    expect(permissions.pages).toBe('write');
    expect(permissions['id-token']).toBe('write');
  });

  it('builds from docs-site directory', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('docs-site');
  });
});
