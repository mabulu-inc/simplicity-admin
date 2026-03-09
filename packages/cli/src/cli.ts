#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMANDS = ['init', 'dev', 'build', 'start', 'generate', 'migrate', 'env'] as const;

function getVersion(): string {
  const pkgPath = resolve(fileURLToPath(import.meta.url), '../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

function printHelp(): void {
  const help = `
Usage: simplicity-admin <command> [options]

Commands:
  init [dir]       Scaffold a new project
  dev              Start development server
  build            Build for production
  start            Start production server
  generate         Generate schema-flow YAML from existing DB
  migrate          Run schema-flow migrations
  env              Export/import admin configuration

Options:
  --help           Show this help message
  --version        Show version number
`.trimStart();

  process.stdout.write(help);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(getVersion() + '\n');
    process.exit(0);
  }

  const command = args[0];

  if (!COMMANDS.includes(command as (typeof COMMANDS)[number])) {
    process.stderr.write(`Unknown command '${command}'. Run simplicity-admin --help for usage.\n`);
    process.exit(1);
  }

  // Commands will be implemented in subsequent tasks
  process.stdout.write(`Command '${command}' is not yet implemented.\n`);
}

main();
