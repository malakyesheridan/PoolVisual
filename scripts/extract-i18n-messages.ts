// scripts/extract-i18n-messages.ts
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse'; // Import traverse

interface Message {
  id: string;
  defaultMessage: string;
  file: string;
  line: number;
}

export async function extractMessages() {
  const files = await glob('client/src/**/*.{ts,tsx}');
  const messages: Message[] = [];
  
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
            messages.push({
              id: arg.value,
              defaultMessage: arg.value,
              file,
              line: path.node.loc?.start.line || 0, // Use locations
            });
          }
        }
      },
    });
  }
  
  // Generate message catalog
  const catalog = messages.reduce((acc, msg) => {
    const [namespace, ...keyParts] = msg.id.split('.');
    const key = keyParts.join('.');
    
    if (!acc[namespace]) {
      acc[namespace] = {};
    }
    
    acc[namespace][key] = msg.defaultMessage;
    return acc;
  }, {} as Record<string, Record<string, string>>);
  
  writeFileSync(
    'client/src/i18n/messages/en.json',
    JSON.stringify(catalog, null, 2)
  );
  
  console.log(`✅ Extracted ${messages.length} messages`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extractMessages().catch(console.error);
}

