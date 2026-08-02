import { readFileSync } from 'node:fs';
import path from 'node:path';

const appClientPath = path.join(process.cwd(), 'src', 'api', 'supabase', 'appClient.js');
const source = readFileSync(appClientPath, 'utf8');

const optionGroupMatch = source.match(/OptionGroup:\s*\[([^\]]+)\]/s);

if (!optionGroupMatch) {
  throw new Error('OptionGroup legacy projection was not found in appClient.js.');
}

const fields = optionGroupMatch[1]
  .split(',')
  .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

for (const requiredField of ['template_group_id', 'is_template', 'size_template']) {
  if (!fields.includes(requiredField)) {
    throw new Error(`Missing OptionGroup projection field: ${requiredField}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  checkedFile: appClientPath,
  fieldsChecked: ['template_group_id', 'is_template', 'size_template'],
}, null, 2));
