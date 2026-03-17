import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const ROOT = resolve(__dirname, '..', '..', '..');

function loadWorkflow(name: string): Record<string, unknown> {
  const content = readFileSync(
    resolve(ROOT, '.github', 'workflows', name),
    'utf-8',
  );
  return parse(content) as Record<string, unknown>;
}

describe('CI workflow (.github/workflows/ci.yml)', () => {
  let workflow: Record<string, unknown>;

  it('parses as valid YAML', () => {
    workflow = loadWorkflow('ci.yml');
    expect(workflow).toBeDefined();
    expect(workflow.name).toBeDefined();
  });

  it('triggers on pull requests and pushes to main', () => {
    workflow = loadWorkflow('ci.yml');
    const on = workflow.on as Record<string, unknown>;
    expect(on).toBeDefined();

    const push = on.push as Record<string, unknown>;
    expect(push).toBeDefined();
    expect(push.branches).toContain('main');

    const pr = on.pull_request as Record<string, unknown>;
    expect(pr).toBeDefined();
  });

  it('uses pnpm with caching', () => {
    workflow = loadWorkflow('ci.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    expect(jobs).toBeDefined();

    const checkJob = jobs.check;
    expect(checkJob).toBeDefined();

    const steps = checkJob.steps as Array<Record<string, unknown>>;
    const pnpmSetup = steps.find(
      (s) =>
        typeof s.uses === 'string' &&
        s.uses.startsWith('pnpm/action-setup@'),
    );
    expect(pnpmSetup).toBeDefined();

    const nodeSetup = steps.find(
      (s) =>
        typeof s.uses === 'string' &&
        s.uses.startsWith('actions/setup-node@'),
    );
    expect(nodeSetup).toBeDefined();
    const nodeWith = nodeSetup!.with as Record<string, unknown>;
    expect(nodeWith.cache).toBe('pnpm');
  });

  it('runs pnpm check', () => {
    workflow = loadWorkflow('ci.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const steps = jobs.check.steps as Array<Record<string, unknown>>;

    const checkStep = steps.find(
      (s) => typeof s.run === 'string' && s.run.includes('pnpm check'),
    );
    expect(checkStep).toBeDefined();
  });

  it('includes a PostgreSQL service container', () => {
    workflow = loadWorkflow('ci.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const services = jobs.check.services as Record<
      string,
      Record<string, unknown>
    >;
    expect(services).toBeDefined();
    expect(services.postgres).toBeDefined();

    const pg = services.postgres;
    expect(pg.image).toMatch(/^postgres:/);
  });
});

describe('Publish workflow (.github/workflows/publish.yml)', () => {
  let workflow: Record<string, unknown>;

  it('parses as valid YAML', () => {
    workflow = loadWorkflow('publish.yml');
    expect(workflow).toBeDefined();
    expect(workflow.name).toBeDefined();
  });

  it('triggers only on version tags', () => {
    workflow = loadWorkflow('publish.yml');
    const on = workflow.on as Record<string, unknown>;
    const push = on.push as Record<string, unknown>;
    expect(push.tags).toContain('v*');

    // Should NOT trigger on pull_request
    expect(on.pull_request).toBeUndefined();
  });

  it('publishes to GitHub Packages registry', () => {
    workflow = loadWorkflow('publish.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const publishJob = jobs.publish;
    expect(publishJob).toBeDefined();

    const steps = publishJob.steps as Array<Record<string, unknown>>;

    // Should configure npm registry for GitHub Packages
    const nodeSetup = steps.find(
      (s) =>
        typeof s.uses === 'string' &&
        s.uses.startsWith('actions/setup-node@'),
    );
    expect(nodeSetup).toBeDefined();
    const nodeWith = nodeSetup!.with as Record<string, unknown>;
    expect(nodeWith['registry-url']).toBe('https://npm.pkg.github.com');
  });

  it('uses GITHUB_TOKEN for authentication', () => {
    workflow = loadWorkflow('publish.yml');
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const publishJob = jobs.publish;
    const steps = publishJob.steps as Array<Record<string, unknown>>;

    // Find the publish step and verify it uses GITHUB_TOKEN
    const publishStep = steps.find(
      (s) => typeof s.run === 'string' && s.run.includes('publish'),
    );
    expect(publishStep).toBeDefined();

    const env = publishStep!.env as Record<string, string>;
    expect(env.NODE_AUTH_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
  });

  it('has permissions to write packages', () => {
    workflow = loadWorkflow('publish.yml');

    // Check top-level or job-level permissions
    const topPermissions = workflow.permissions as
      | Record<string, string>
      | undefined;
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const jobPermissions = jobs.publish.permissions as
      | Record<string, string>
      | undefined;

    const permissions = jobPermissions ?? topPermissions;
    expect(permissions).toBeDefined();
    expect(permissions!.packages).toBe('write');
  });
});
