#!/usr/bin/env node

// Force stdout and stderr to not buffer
process.stdout._handle.setBlocking(true);
process.stderr._handle.setBlocking(true);

console.log('[START] Loading server...');

try {
    require('./server');
    console.log('[START] Server module loaded successfully');
} catch (error) {
    console.error('[START] FATAL ERROR:', error);
    console.error('[START] Stack:', error.stack);
    process.exit(1);
}
