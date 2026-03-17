import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';

const SCHEMA_DIR = resolve(__dirname, '../schema');

function loadYaml(relativePath: string): Record<string, unknown> {
  const fullPath = join(SCHEMA_DIR, relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return parse(content) as Record<string, unknown>;
}

describe('begin_session role validation (B-SEC-013)', () => {
  const schema = loadYaml('functions/begin_session.yaml');
  const body = schema.body as string;

  describe('known roles are accepted', () => {
    const knownRoles = ['anon', 'app_viewer', 'app_editor', 'app_admin'];

    for (const role of knownRoles) {
      it(`whitelist includes '${role}'`, () => {
        expect(body).toContain(role);
      });
    }
  });

  describe('unknown roles raise an exception', () => {
    it('body contains a RAISE EXCEPTION for invalid roles', () => {
      expect(body.toLowerCase()).toContain('raise exception');
    });

    it('body validates p_role against the whitelist before SET ROLE', () => {
      const raiseIndex = body.toLowerCase().indexOf('raise exception');
      const setRoleIndex = body.toLowerCase().indexOf('set local role');
      // The validation (raise) must appear before the SET ROLE to prevent escalation
      expect(raiseIndex).toBeGreaterThan(-1);
      expect(setRoleIndex).toBeGreaterThan(-1);
      expect(raiseIndex).toBeLessThan(setRoleIndex);
    });

    it('body uses an IF/NOT IN or equivalent check on p_role', () => {
      // The body should check p_role against the known roles list
      expect(body).toMatch(/p_role\s+(NOT\s+IN|<>|!=)/i);
    });
  });

  describe('EXECUTE grant is restricted to authenticator only', () => {
    it('grants EXECUTE only to authenticator', () => {
      const grants = schema.grants as Array<Record<string, unknown>>;
      expect(grants).toBeDefined();
      expect(grants).toHaveLength(1);
      expect(grants[0].to).toBe('authenticator');
      expect(grants[0].privileges).toEqual(['EXECUTE']);
    });

    it('does not grant EXECUTE to public or any app role', () => {
      const grants = schema.grants as Array<Record<string, unknown>>;
      const grantees = grants.map((g) => g.to);
      expect(grantees).not.toContain('public');
      expect(grantees).not.toContain('anon');
      expect(grantees).not.toContain('app_viewer');
      expect(grantees).not.toContain('app_editor');
      expect(grantees).not.toContain('app_admin');
    });
  });
});
