import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';

const SCHEMA_DIR = resolve(__dirname, '../schema');

function loadYaml(relativePath: string): unknown {
  const fullPath = join(SCHEMA_DIR, relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return parse(content);
}

describe('Schema YAML files — structure validation', () => {
  // --- Tables ---
  describe('tables/users.yaml', () => {
    it('exists and parses', () => {
      const schema = loadYaml('tables/users.yaml') as Record<string, unknown>;
      expect(schema.table).toBe('users');
    });

    it('has required columns', () => {
      const schema = loadYaml('tables/users.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const names = columns.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('email');
      expect(names).toContain('password_hash');
      expect(names).toContain('display_name');
      expect(names).toContain('super_admin');
      expect(names).toContain('active');
    });

    it('has id as uuid primary key', () => {
      const schema = loadYaml('tables/users.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const id = columns.find((c) => c.name === 'id');
      expect(id?.type).toBe('uuid');
      expect(id?.primary_key).toBe(true);
    });

    it('has email as unique', () => {
      const schema = loadYaml('tables/users.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const email = columns.find((c) => c.name === 'email');
      expect(email?.unique).toBe(true);
    });

    it('uses timestamps mixin', () => {
      const schema = loadYaml('tables/users.yaml') as Record<string, unknown>;
      expect(schema.mixins).toEqual(expect.arrayContaining(['timestamps']));
    });
  });

  describe('tables/tenants.yaml', () => {
    it('exists and parses', () => {
      const schema = loadYaml('tables/tenants.yaml') as Record<string, unknown>;
      expect(schema.table).toBe('tenants');
    });

    it('has required columns', () => {
      const schema = loadYaml('tables/tenants.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const names = columns.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('name');
      expect(names).toContain('slug');
    });

    it('has slug as unique', () => {
      const schema = loadYaml('tables/tenants.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const slug = columns.find((c) => c.name === 'slug');
      expect(slug?.unique).toBe(true);
    });

    it('uses timestamps mixin', () => {
      const schema = loadYaml('tables/tenants.yaml') as Record<string, unknown>;
      expect(schema.mixins).toEqual(expect.arrayContaining(['timestamps']));
    });
  });

  describe('tables/memberships.yaml', () => {
    it('exists and parses', () => {
      const schema = loadYaml('tables/memberships.yaml') as Record<string, unknown>;
      expect(schema.table).toBe('memberships');
    });

    it('has required columns', () => {
      const schema = loadYaml('tables/memberships.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const names = columns.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('user_id');
      expect(names).toContain('tenant_id');
      expect(names).toContain('role');
    });

    it('has foreign keys to users and tenants', () => {
      const schema = loadYaml('tables/memberships.yaml') as Record<string, unknown>;
      const columns = schema.columns as Array<Record<string, unknown>>;
      const userId = columns.find((c) => c.name === 'user_id') as Record<string, unknown>;
      const tenantId = columns.find((c) => c.name === 'tenant_id') as Record<string, unknown>;
      expect((userId.references as Record<string, unknown>).table).toBe('users');
      expect((tenantId.references as Record<string, unknown>).table).toBe('tenants');
    });

    it('has unique constraint on user_id + tenant_id + role', () => {
      const schema = loadYaml('tables/memberships.yaml') as Record<string, unknown>;
      const indexes = schema.indexes as Array<Record<string, unknown>>;
      const uniqueIdx = indexes.find((i) => i.unique === true);
      expect(uniqueIdx).toBeDefined();
      expect(uniqueIdx?.columns).toEqual(
        expect.arrayContaining(['user_id', 'tenant_id', 'role']),
      );
    });

    it('uses timestamps mixin', () => {
      const schema = loadYaml('tables/memberships.yaml') as Record<string, unknown>;
      expect(schema.mixins).toEqual(expect.arrayContaining(['timestamps']));
    });
  });

  // --- Roles ---
  describe('roles', () => {
    const roleFiles = [
      { file: 'roles/authenticator.yaml', name: 'authenticator', login: true },
      { file: 'roles/anon.yaml', name: 'anon', login: false },
      { file: 'roles/app_viewer.yaml', name: 'app_viewer', login: false },
      { file: 'roles/app_editor.yaml', name: 'app_editor', login: false },
      { file: 'roles/app_admin.yaml', name: 'app_admin', login: false },
    ];

    for (const { file, name, login } of roleFiles) {
      it(`${file} exists and has correct role name`, () => {
        const schema = loadYaml(file) as Record<string, unknown>;
        expect(schema.role).toBe(name);
      });

      it(`${file} has login: ${login}`, () => {
        const schema = loadYaml(file) as Record<string, unknown>;
        expect(schema.login).toBe(login);
      });
    }

    it('authenticator can switch to app roles', () => {
      const schema = loadYaml('roles/authenticator.yaml') as Record<string, unknown>;
      // authenticator grants membership to app roles
      expect(schema.in).toEqual(
        expect.arrayContaining(['anon', 'app_viewer', 'app_editor', 'app_admin']),
      );
    });
  });

  // --- Functions ---
  describe('functions', () => {
    it('current_user_id.yaml exists and returns uuid', () => {
      const schema = loadYaml('functions/current_user_id.yaml') as Record<string, unknown>;
      expect(schema.name).toBe('current_user_id');
      expect(schema.returns).toBe('uuid');
      expect(schema.language).toBe('sql');
    });

    it('current_tenant_id.yaml exists and returns uuid', () => {
      const schema = loadYaml('functions/current_tenant_id.yaml') as Record<string, unknown>;
      expect(schema.name).toBe('current_tenant_id');
      expect(schema.returns).toBe('uuid');
      expect(schema.language).toBe('sql');
    });

    it('begin_session.yaml exists and returns void', () => {
      const schema = loadYaml('functions/begin_session.yaml') as Record<string, unknown>;
      expect(schema.name).toBe('begin_session');
      expect(schema.returns).toBe('void');
    });

    it('begin_session sets role and pg settings', () => {
      const schema = loadYaml('functions/begin_session.yaml') as Record<string, unknown>;
      const body = schema.body as string;
      expect(body).toContain('set local role');
      expect(body).toContain('app.user_id');
      expect(body).toContain('app.tenant_id');
    });
  });

  // --- Mixins ---
  describe('mixins', () => {
    it('timestamps.yaml has created_at and updated_at columns', () => {
      const schema = loadYaml('mixins/timestamps.yaml') as Record<string, unknown>;
      expect(schema.mixin).toBe('timestamps');
      const columns = schema.columns as Array<Record<string, unknown>>;
      const names = columns.map((c) => c.name);
      expect(names).toContain('created_at');
      expect(names).toContain('updated_at');
    });

    it('timestamps.yaml has update trigger', () => {
      const schema = loadYaml('mixins/timestamps.yaml') as Record<string, unknown>;
      const triggers = schema.triggers as Array<Record<string, unknown>>;
      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers[0].events).toContain('UPDATE');
    });

    it('tenant_scoped.yaml has tenant_id column with FK to tenants', () => {
      const schema = loadYaml('mixins/tenant_scoped.yaml') as Record<string, unknown>;
      expect(schema.mixin).toBe('tenant_scoped');
      const columns = schema.columns as Array<Record<string, unknown>>;
      const tenantId = columns.find((c) => c.name === 'tenant_id') as Record<string, unknown>;
      expect(tenantId).toBeDefined();
      expect(tenantId.type).toBe('uuid');
      expect((tenantId.references as Record<string, unknown>).table).toBe('tenants');
    });

    it('tenant_scoped.yaml enables RLS with tenant isolation policy', () => {
      const schema = loadYaml('mixins/tenant_scoped.yaml') as Record<string, unknown>;
      const policies = schema.policies as Array<Record<string, unknown>>;
      expect(policies.length).toBeGreaterThan(0);
      const policy = policies[0];
      const using = policy.using as string;
      expect(using).toContain("current_setting('app.tenant_id')");
      expect(using).toContain("current_setting('app.is_super_admin'");
    });

    it('auditable.yaml has created_by and updated_by columns', () => {
      const schema = loadYaml('mixins/auditable.yaml') as Record<string, unknown>;
      expect(schema.mixin).toBe('auditable');
      const columns = schema.columns as Array<Record<string, unknown>>;
      const names = columns.map((c) => c.name);
      expect(names).toContain('created_by');
      expect(names).toContain('updated_by');
    });
  });

  // --- All files exist ---
  describe('all required files exist', () => {
    const requiredFiles = [
      'tables/users.yaml',
      'tables/tenants.yaml',
      'tables/memberships.yaml',
      'roles/authenticator.yaml',
      'roles/anon.yaml',
      'roles/app_viewer.yaml',
      'roles/app_editor.yaml',
      'roles/app_admin.yaml',
      'functions/current_user_id.yaml',
      'functions/current_tenant_id.yaml',
      'functions/begin_session.yaml',
      'mixins/timestamps.yaml',
      'mixins/tenant_scoped.yaml',
      'mixins/auditable.yaml',
    ];

    for (const file of requiredFiles) {
      it(`${file} exists`, () => {
        expect(existsSync(join(SCHEMA_DIR, file))).toBe(true);
      });
    }
  });
});
