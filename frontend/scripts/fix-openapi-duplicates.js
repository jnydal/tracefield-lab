#!/usr/bin/env node

/**
 * Pre-processing script to fix duplicate operationIds in the OpenAPI spec.
 * This ensures unique operationIds before type generation, which is better
 * than post-processing the generated types.
 * 
 * This script fixes the OpenAPI spec in-place by making duplicate operationIds unique.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENAPI_FILE = join(__dirname, '..', 'api-openapi.json');
const TYPES_FILE = join(__dirname, '..', 'src', 'generated', 'api', 'types.ts');

try {
  const spec = JSON.parse(readFileSync(OPENAPI_FILE, 'utf-8'));
  const seen = new Map();
  let fixedCount = 0;
  const fixedIds = [];
  
  // Iterate through all paths and operations
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation && typeof operation === 'object' && operation.operationId) {
        const operationId = operation.operationId;
        
        if (seen.has(operationId)) {
          // This is a duplicate - make it unique
          const count = seen.get(operationId) + 1;
          seen.set(operationId, count);
          
          // Create a unique operationId by appending a meaningful suffix
          // Use path segments to make it descriptive
          const pathSegments = path.split('/').filter(Boolean);
          const lastSegment = pathSegments[pathSegments.length - 1] || '';
          // Extract meaningful parts from path (e.g., "order" from "/forum/{threadId}/{limit}/{offset}/{order}")
          const suffix = lastSegment.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]/g, '') || `V${count}`;
          const newOperationId = `${operationId}_${suffix}`;
          
          fixedIds.push({ old: operationId, new: newOperationId, path, method });
          operation.operationId = newOperationId;
          fixedCount++;
        } else {
          seen.set(operationId, 0);
        }
      }
    }
  }
  
  if (fixedCount > 0) {
    // Write the fixed spec to a temporary file (don't modify original)
    const fixedFile = join(tmpdir(), `api-openapi-fixed-${Date.now()}.json`);
    writeFileSync(fixedFile, JSON.stringify(spec, null, 2), 'utf-8');
    
    console.log(`✅ Fixed ${fixedCount} duplicate operationId(s) in OpenAPI spec:`);
    fixedIds.forEach(({ old, new: newId, path, method }) => {
      console.log(`   ${old} -> ${newId} (${method.toUpperCase()} ${path})`);
    });
    
    // Generate types using the fixed spec
    console.log('\n🚀 Generating types from fixed OpenAPI spec...');
    try {
      execSync(`openapi-typescript "${fixedFile}" -o "${TYPES_FILE}"`, { stdio: 'inherit' });
    } finally {
      // Clean up temporary file
      try {
        unlinkSync(fixedFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } else {
    console.log('✅ No duplicate operationIds found');
    // Generate types from original spec
    execSync(`openapi-typescript "${OPENAPI_FILE}" -o "${TYPES_FILE}"`, { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error fixing OpenAPI spec:', error.message);
  process.exit(1);
}

