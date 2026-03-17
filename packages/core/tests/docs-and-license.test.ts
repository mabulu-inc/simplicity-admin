import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const ROOT = resolve(__dirname, '..', '..', '..');

function readRoot(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

function loadWorkflow(name: string): Record<string, unknown> {
  const content = readFileSync(
    resolve(ROOT, '.github', 'workflows', name),
    'utf-8',
  );
  return parse(content) as Record<string, unknown>;
}

describe('LICENSE', () => {
  let content: string;

  it('exists at repo root', () => {
    expect(existsSync(resolve(ROOT, 'LICENSE'))).toBe(true);
    content = readRoot('LICENSE');
  });

  it('is BSL 1.1', () => {
    content = readRoot('LICENSE');
    expect(content).toContain('Business Source License 1.1');
  });

  it('names Mabulu Inc. as Licensor', () => {
    content = readRoot('LICENSE');
    expect(content).toContain('Mabulu Inc.');
  });

  it('names SIMPLICITY-ADMIN as Licensed Work', () => {
    content = readRoot('LICENSE');
    expect(content.toUpperCase()).toContain('SIMPLICITY-ADMIN');
  });

  it('specifies Apache 2.0 as Change License', () => {
    content = readRoot('LICENSE');
    expect(content).toContain('Apache License, Version 2.0');
  });

  it('includes the Additional Use Grant', () => {
    content = readRoot('LICENSE');
    expect(content.toLowerCase()).toContain('additional use grant');
  });

  it('specifies a Change Date', () => {
    content = readRoot('LICENSE');
    expect(content.toLowerCase()).toContain('change date');
  });
});

describe('README.md', () => {
  let content: string;

  it('exists at repo root', () => {
    expect(existsSync(resolve(ROOT, 'README.md'))).toBe(true);
    content = readRoot('README.md');
  });

  it('includes the project name', () => {
    content = readRoot('README.md');
    expect(content.toUpperCase()).toContain('SIMPLICITY-ADMIN');
  });

  it('includes the PRD §1 one-liner vision', () => {
    content = readRoot('README.md');
    // Should mention the core value prop — a dependency that gives admin suite from a database
    expect(content.toLowerCase()).toContain('admin');
    expect(content.toLowerCase()).toContain('database');
  });

  it('has a quick start section', () => {
    content = readRoot('README.md');
    expect(content.toLowerCase()).toContain('quick start');
  });

  it('mentions feature highlights', () => {
    content = readRoot('README.md');
    const lower = content.toLowerCase();
    expect(lower).toContain('schema');
    expect(lower).toContain('rbac');
    expect(lower).toContain('provider');
  });

  it('has a package table with all six packages', () => {
    content = readRoot('README.md');
    const pkgs = ['core', 'db', 'auth', 'api', 'ui', 'cli'];
    for (const pkg of pkgs) {
      expect(content).toContain(pkg);
    }
  });

  it('links to the docs site', () => {
    content = readRoot('README.md');
    expect(content).toContain('simplicity-admin');
    // Should have a documentation link
    expect(content.toLowerCase()).toContain('documentation');
  });

  it('has development instructions', () => {
    content = readRoot('README.md');
    expect(content).toContain('pnpm install');
    expect(content).toContain('pnpm check');
  });

  it('has a license section referencing BSL 1.1', () => {
    content = readRoot('README.md');
    expect(content).toContain('BSL 1.1');
    expect(content).toContain('LICENSE');
  });
});

describe('deploy-docs workflow (.github/workflows/deploy-docs.yml)', () => {
  let workflow: Record<string, unknown>;

  it('parses as valid YAML', () => {
    workflow = loadWorkflow('deploy-docs.yml');
    expect(workflow).toBeDefined();
    expect(workflow.name).toBeDefined();
  });

  it('triggers on pushes to main that touch docs-site/**', () => {
    workflow = loadWorkflow('deploy-docs.yml');
    const on = workflow.on as Record<string, unknown>;
    const push = on.push as Record<string, unknown>;
    expect(push.branches).toContain('main');
    const paths = push.paths as string[];
    expect(paths).toBeDefined();
    expect(paths.some((p: string) => p.includes('docs-site'))).toBe(true);
  });

  it('uses GitHub Pages deployment actions', () => {
    workflow = loadWorkflow('deploy-docs.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const allSteps: Array<Record<string, unknown>> = [];
    for (const job of Object.values(jobs)) {
      if (Array.isArray(job.steps)) {
        allSteps.push(...(job.steps as Array<Record<string, unknown>>));
      }
    }

    const uploadArtifact = allSteps.find(
      (s) =>
        typeof s.uses === 'string' &&
        s.uses.includes('upload-pages-artifact'),
    );
    expect(uploadArtifact).toBeDefined();

    const deployPages = allSteps.find(
      (s) =>
        typeof s.uses === 'string' && s.uses.includes('deploy-pages'),
    );
    expect(deployPages).toBeDefined();
  });

  it('has pages write permission', () => {
    workflow = loadWorkflow('deploy-docs.yml');
    const topPermissions = workflow.permissions as
      | Record<string, string>
      | undefined;
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;

    let hasPagesPerm = false;
    if (topPermissions?.pages === 'write') hasPagesPerm = true;
    for (const job of Object.values(jobs)) {
      const perms = job.permissions as Record<string, string> | undefined;
      if (perms?.pages === 'write') hasPagesPerm = true;
    }
    expect(hasPagesPerm).toBe(true);
  });
});

describe('docs-site/', () => {
  it('has a package.json', () => {
    expect(existsSync(resolve(ROOT, 'docs-site', 'package.json'))).toBe(true);
  });

  it('has an astro.config.mjs', () => {
    expect(existsSync(resolve(ROOT, 'docs-site', 'astro.config.mjs'))).toBe(
      true,
    );
  });

  it('configures base path as /simplicity-admin', () => {
    const config = readRoot('docs-site/astro.config.mjs');
    expect(config).toContain('/simplicity-admin');
  });

  it('has tsconfig.json', () => {
    expect(existsSync(resolve(ROOT, 'docs-site', 'tsconfig.json'))).toBe(true);
  });

  it('has Getting Started docs', () => {
    const docsBase = resolve(ROOT, 'docs-site', 'src', 'content', 'docs');
    expect(existsSync(resolve(docsBase, 'getting-started', 'introduction.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'getting-started', 'quick-start.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'getting-started', 'configuration.mdx'))).toBe(true);
  });

  it('has Core Concepts docs', () => {
    const docsBase = resolve(ROOT, 'docs-site', 'src', 'content', 'docs');
    expect(existsSync(resolve(docsBase, 'core-concepts', 'architecture.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'core-concepts', 'schema-as-truth.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'core-concepts', 'rbac.mdx'))).toBe(true);
  });

  it('has Package docs for all six packages', () => {
    const docsBase = resolve(ROOT, 'docs-site', 'src', 'content', 'docs');
    const pkgs = ['core', 'db', 'auth', 'api', 'ui', 'cli'];
    for (const pkg of pkgs) {
      expect(existsSync(resolve(docsBase, 'packages', `${pkg}.mdx`))).toBe(true);
    }
  });

  it('has Guide docs', () => {
    const docsBase = resolve(ROOT, 'docs-site', 'src', 'content', 'docs');
    expect(existsSync(resolve(docsBase, 'guides', 'adding-a-table.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'guides', 'customizing-auth.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'guides', 'writing-plugins.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'guides', 'embedding.mdx'))).toBe(true);
  });

  it('has Reference docs', () => {
    const docsBase = resolve(ROOT, 'docs-site', 'src', 'content', 'docs');
    expect(existsSync(resolve(docsBase, 'reference', 'config-options.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'reference', 'cli-commands.mdx'))).toBe(true);
    expect(existsSync(resolve(docsBase, 'reference', 'environment-variables.mdx'))).toBe(true);
  });
});
