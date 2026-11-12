import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tag = process.env.GITHUB_REF_NAME || '';
const version = tag.replace(/^v/, '');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`A tag precisa ter o formato vMAJOR.MINOR.PATCH. Valor recebido: ${tag}`);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(scriptDirectory, '..', 'frontend', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
