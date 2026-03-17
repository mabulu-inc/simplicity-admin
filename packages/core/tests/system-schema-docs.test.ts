import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('T-095: System schema documentation', () => {
  describe('Quick Start page callout', () => {
    it('contains an admonition about _simplicity schema creation', () => {
      const content = readFile('docs-site/src/content/docs/getting-started/quick-start.md');
      expect(content).toContain('_simplicity');
      expect(content).toMatch(/:::(note|caution|tip|warning)/);
    });

    it('mentions the callout before any run/dev commands', () => {
      const content = readFile('docs-site/src/content/docs/getting-started/quick-start.md');
      const calloutIndex = content.indexOf(':::');
      const devCommandIndex = content.indexOf('npm run dev');
      expect(calloutIndex).toBeGreaterThan(-1);
      expect(calloutIndex).toBeLessThan(devCommandIndex);
    });

    it('mentions systemSchema config option', () => {
      const content = readFile('docs-site/src/content/docs/getting-started/quick-start.md');
      expect(content).toContain('systemSchema');
    });
  });

  describe('Introduction page callout', () => {
    it('contains an admonition about _simplicity schema creation', () => {
      const content = readFile('docs-site/src/content/docs/getting-started/introduction.md');
      expect(content).toContain('_simplicity');
      expect(content).toMatch(/:::(note|caution|tip|warning)/);
    });

    it('mentions systemSchema config option', () => {
      const content = readFile('docs-site/src/content/docs/getting-started/introduction.md');
      expect(content).toContain('systemSchema');
    });
  });

  describe('README.md callout', () => {
    it('mentions _simplicity schema creation in Quick Start section', () => {
      const content = readFile('README.md');
      const quickStartIndex = content.indexOf('## Quick Start');
      const nextSectionIndex = content.indexOf('## ', quickStartIndex + 1);
      const quickStartSection = content.slice(quickStartIndex, nextSectionIndex);
      expect(quickStartSection).toContain('_simplicity');
    });
  });

  describe('System Schema reference page', () => {
    const pagePath = 'docs-site/src/content/docs/reference/system-schema.md';

    it('exists', () => {
      expect(() => readFile(pagePath)).not.toThrow();
    });

    it('has valid frontmatter with title', () => {
      const content = readFile(pagePath);
      expect(content).toMatch(/^---\ntitle:/);
    });

    it('documents when the schema is created (bootstrap)', () => {
      const content = readFile(pagePath);
      expect(content).toContain('bootstrap');
    });

    it('documents the default schema name', () => {
      const content = readFile(pagePath);
      expect(content).toContain('_simplicity');
    });

    it('documents systemSchema config option', () => {
      const content = readFile(pagePath);
      expect(content).toContain('systemSchema');
    });

    it('documents all 11 system tables', () => {
      const content = readFile(pagePath);
      const tables = [
        'users',
        'tenants',
        'memberships',
        'revoked_tokens',
        'simplicity_state_machines',
        'simplicity_transition_log',
        'simplicity_dashboards',
        'simplicity_widgets',
        'simplicity_notification_rules',
        'simplicity_notifications',
        'simplicity_permission_overrides',
      ];
      for (const table of tables) {
        expect(content).toContain(table);
      }
    });

    it('documents default seed data', () => {
      const content = readFile(pagePath);
      expect(content).toContain('admin@localhost');
      expect(content).toContain('Default');
      expect(content).toContain('changeme');
    });

    it('documents all five database roles', () => {
      const content = readFile(pagePath);
      const roles = ['authenticator', 'anon', 'app_viewer', 'app_editor', 'app_admin'];
      for (const role of roles) {
        expect(content).toContain(role);
      }
    });

    it('documents column details for tables', () => {
      const content = readFile(pagePath);
      // Spot-check key columns across several tables
      expect(content).toContain('password_hash');
      expect(content).toContain('super_admin');
      expect(content).toContain('tenant_id');
      expect(content).toContain('user_id');
      expect(content).toContain('token_hash');
      expect(content).toContain('from_state');
      expect(content).toContain('to_state');
    });

    it('documents access grants for tables', () => {
      const content = readFile(pagePath);
      expect(content).toContain('SELECT');
      expect(content).toContain('INSERT');
      expect(content).toContain('UPDATE');
      expect(content).toContain('DELETE');
    });
  });

  describe('Sidebar configuration', () => {
    it('includes System Schema entry in the Reference section', () => {
      const content = readFile('docs-site/astro.config.mjs');
      expect(content).toContain('system-schema');
      expect(content).toContain('System Schema');
    });
  });
});
