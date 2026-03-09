import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

interface InitOptions {
  dir: string;
  port: number;
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

export function runInit(args: string[]): void {
  const dirArg = args.find((a) => !a.startsWith('-'));
  if (!dirArg) {
    process.stderr.write("Usage: simplicity-admin init <dir>\n");
    process.exit(1);
  }

  const port = 3000;
  const targetDir = path.resolve(dirArg);
  const projectName = dirArg === '.' ? path.basename(process.cwd()) : path.basename(targetDir);

  // Check if directory exists and is non-empty
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

  // Write templated files
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

  // Create empty directories
  mkdirSync(path.join(targetDir, 'schema'), { recursive: true });
  mkdirSync(path.join(targetDir, 'views'), { recursive: true });

  // Success message
  const displayName = dirArg === '.' ? path.basename(process.cwd()) : path.basename(targetDir);
  const cdLine = dirArg === '.' ? '' : `  cd ${displayName}\n`;
  process.stdout.write(
    `Created ${displayName}/\n\n${cdLine}  npx simplicity-admin dev\n\nConfig: simplicity-admin.config.ts (edit anytime)\n`,
  );
}
