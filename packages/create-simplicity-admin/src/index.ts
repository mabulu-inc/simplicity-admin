#!/usr/bin/env node

import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

function getVersion(): string {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}

function printHelp(): void {
  const help = `Usage: create-simplicity-admin <directory>

Scaffold a new simplicity-admin project.

Options:
  --help           Show this help message
  --version        Show version number
`;
  process.stdout.write(help);
}

function renderTemplate(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function readTemplate(name: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
}

export function scaffold(args: string[]): void {
  const dirArg = args.find((a) => !a.startsWith('-'));
  if (!dirArg) {
    process.stderr.write('Usage: create-simplicity-admin <directory>\n');
    process.exit(1);
  }

  const port = 3000;
  const targetDir = path.resolve(dirArg);
  const projectName = dirArg === '.' ? path.basename(process.cwd()) : path.basename(targetDir);

  if (existsSync(targetDir)) {
    const entries = readdirSync(targetDir);
    if (entries.length > 0) {
      process.stderr.write(
        `Directory '${dirArg === '.' ? '.' : path.basename(targetDir)}' already exists and is not empty\n`,
      );
      process.exit(1);
    }
  } else {
    mkdirSync(targetDir, { recursive: true });
  }

  const vars: Record<string, string> = {
    PROJECT_NAME: projectName,
    PORT: String(port),
  };

  const files: Array<[string, string]> = [
    ['package.json', renderTemplate(readTemplate('package.json.tmpl'), vars)],
    ['simplicity-admin.config.ts', renderTemplate(readTemplate('config.ts.tmpl'), vars)],
    ['compose.yaml', renderTemplate(readTemplate('compose.yaml.tmpl'), vars)],
    ['.env.example', renderTemplate(readTemplate('env.example.tmpl'), vars)],
    ['.gitignore', renderTemplate(readTemplate('gitignore.tmpl'), vars)],
  ];

  for (const [filename, content] of files) {
    writeFileSync(path.join(targetDir, filename), content, 'utf-8');
  }

  mkdirSync(path.join(targetDir, 'schema'), { recursive: true });
  mkdirSync(path.join(targetDir, 'views'), { recursive: true });

  const displayName = dirArg === '.' ? path.basename(process.cwd()) : path.basename(targetDir);
  const cdLine = dirArg === '.' ? '' : `  cd ${displayName}\n`;
  process.stdout.write(
    `Created ${displayName}/\n\n${cdLine}  npx simplicity-admin dev\n\nConfig: simplicity-admin.config.ts (edit anytime)\n`,
  );
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(getVersion() + '\n');
  process.exit(0);
}

scaffold(args);
