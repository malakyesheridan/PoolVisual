// scripts/check-i18n-keys.ts
import { readFileSync } from 'fs';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse'; // Import traverse

export async function checkMissingKeys() {
  const catalog = JSON.parse(
    readFileSync('client/src/i18n/messages/en.json', 'utf-8')
  );
  const files = await glob('client/src/**/*.{ts,tsx}');
  const missingKeys: Array<{ key: string; file: string; line: number }> = [];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      sourceFilename: file, // Enable sourceFilename
    });
    
    // Use traverse from @babel/traverse
    traverse(ast, {
      CallExpression(path) {
        if (
          path.node.callee.type === 'Identifier' &&
          path.node.callee.name === 't'
        ) {
          const arg = path.node.arguments[0];
          if (arg.type === 'StringLiteral') {
            const key = arg.value;
            const [namespace, ...keyParts] = key.split('.');
            const subKey = keyParts.join('.');
            
            if (!catalog[namespace] || !catalog[namespace][subKey]) {
              missingKeys.push({
                key,
                file,
                line: path.node.loc?.start.line || 0, // Use locations
              });
            }
          }
        }
      },
    });
  }
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing i18n keys:');
    missingKeys.forEach(({ key, file, line }) => {
      console.error(`  ${file}:${line} - ${key}`);
    });
    process.exit(1);
  }
  
  console.log('✅ All i18n keys found in catalog');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  checkMissingKeys().catch(console.error);
}

