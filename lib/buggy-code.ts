import { readFileSync } from 'fs';
import { join } from 'path';

function readBuggyFile(filename: string): string {
  const filePath = join(process.cwd(), 'lib', 'buggy-code-files', filename);
  return readFileSync(filePath, 'utf8');
}

export const buggyCode = [
  {
    path: "src/StringIssues.tsx",
    contents: readBuggyFile('string-issues.txt')
  },
  {
    path: "src/SyntaxErrors.js",
    contents: readBuggyFile('syntax-errors.txt')
  },
  {
    path: "src/QuoteIssues.js",
    contents: readBuggyFile('quote-issues.txt')
  }
];