interface BuildError {
    type: 'typescript' | 'build' | 'runtime';
    message: string;
    file?: string;
    line?: number;
    column?: number;
}

export interface ErrorDetectionResult {
    hasErrors: boolean;
    errors: BuildError[];
    isInfrastructureOnly: boolean;
}

/**
 * Detects if output contains code-related errors (not infrastructure issues)
 */
export function detectCodeErrors(output: string): ErrorDetectionResult {
    console.log('=== CHECKING OUTPUT FOR CODE ERRORS ===');
    console.log('Output length:', output.length);
    console.log('Full output:', output);

    // Check for actual code errors that users care about
    const hasSyntaxError = output.includes('SyntaxError');
    const hasUnexpectedToken = output.includes('Unexpected token');
    const hasParseError = output.includes('Parse error');
    const hasUnterminatedString = output.includes('Unterminated string');
    const hasModuleError = output.includes('Cannot resolve module') || output.includes('Module not found');
    const hasImportError = output.includes('Cannot resolve import');

    // Check for infrastructure errors that should be ignored
    const isInfrastructureError = output.includes('EACCES: permission denied') ||
        output.includes('failed to load config from /app/vite.config.ts') ||
        output.includes('error when starting dev server') ||
        output.includes('/app/node_modules/.vite-temp/');

    console.log('Error pattern checks (focusing on code errors):');
    console.log('- Has "SyntaxError":', hasSyntaxError);
    console.log('- Has "Unexpected token":', hasUnexpectedToken);
    console.log('- Has "Parse error":', hasParseError);
    console.log('- Has "Unterminated string":', hasUnterminatedString);
    console.log('- Has module/import errors:', hasModuleError || hasImportError);
    console.log('- Is infrastructure error (ignoring):', isInfrastructureError);

    const hasCodeErrors = hasSyntaxError || hasUnexpectedToken || hasParseError ||
        hasUnterminatedString || hasModuleError || hasImportError;

    // Only report actual code errors, not infrastructure issues
    if (hasCodeErrors && !isInfrastructureError) {
        console.log('🔴 CODE ERRORS DETECTED! Parsing...');
        const errors = parseErrorsFromOutput(output);
        console.log('Parsed errors:', errors);

        return {
            hasErrors: true,
            errors,
            isInfrastructureOnly: false
        };
    } else if (isInfrastructureError && !hasCodeErrors) {
        console.log('⚠️  Only infrastructure errors detected (ignoring)');
        return {
            hasErrors: false,
            errors: [],
            isInfrastructureOnly: true
        };
    } else {
        console.log('✅ No code errors detected');
        return {
            hasErrors: false,
            errors: [],
            isInfrastructureOnly: false
        };
    }
}

/**
 * Parses TypeScript compilation errors
 */
export function parseTypeScriptErrors(stderr: string): BuildError[] {
    const errors: BuildError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
        // Match TypeScript error pattern: file(line,column): error TS####: message
        const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
        if (match) {
            const [, file, line, column, message] = match;
            // Filter out common non-critical errors that might be false positives
            const lowerMessage = message.toLowerCase();
            if (!lowerMessage.includes('deprecated') &&
                !lowerMessage.includes('unused') &&
                !lowerMessage.includes('implicit any')) {
                errors.push({
                    type: 'typescript',
                    message: message.trim(),
                    file: file.replace('/app/', ''),
                    line: parseInt(line),
                    column: parseInt(column)
                });
            }
        }
    }

    return errors;
}

/**
 * Parses errors from build/dev server output
 */
function parseErrorsFromOutput(output: string): BuildError[] {
    console.log('🔍 parseErrorsFromOutput called with input length:', output.length);
    const errors: BuildError[] = [];
    const lines = output.split('\n');
    console.log('Total lines to process:', lines.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        console.log(`Line ${i + 1}: "${line}"`);

        // Only match actual code errors, not infrastructure issues
        const hasCodeError = line.includes('SyntaxError') ||
            line.includes('Unexpected token') ||
            line.includes('Parse error') ||
            line.includes('Unterminated string') ||
            line.includes('Cannot resolve module') ||
            line.includes('Module not found') ||
            line.includes('Cannot resolve import');

        // Skip infrastructure errors
        const isInfrastructureError = line.includes('EACCES: permission denied') ||
            line.includes('failed to load config') ||
            line.includes('error when starting dev server') ||
            line.includes('/app/node_modules/.vite-temp/');

        console.log(`  - Has code error: ${hasCodeError}`);
        console.log(`  - Is infrastructure error (skip): ${isInfrastructureError}`);

        if (hasCodeError && !isInfrastructureError) {
            console.log(`  ✅ FOUND ERROR: "${line}"`);
            errors.push({
                type: 'build',
                message: line.trim()
            });
        }
    }

    console.log(`🎯 parseErrorsFromOutput found ${errors.length} errors:`, errors);
    return errors;
} 