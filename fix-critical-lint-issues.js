#!/usr/bin/env node

/**
 * Quick fix script for critical ESLint issues before deployment
 * Fixes the most common and critical issues automatically
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing critical ESLint issues...');

// Fix 1: Replace unescaped apostrophes and quotes in JSX
function fixUnescapedEntities(content) {
  // Fix apostrophes in JSX text
  content = content.replace(/(\w)'(\w)/g, '$1&apos;$2');
  content = content.replace(/(\w)'(s\b)/g, '$1&apos;$2');
  content = content.replace(/(don)'(t\b)/g, '$1&apos;$2');
  content = content.replace(/(can)'(t\b)/g, '$1&apos;$2');
  content = content.replace(/(won)'(t\b)/g, '$1&apos;$2');
  content = content.replace(/(isn)'(t\b)/g, '$1&apos;$2');
  content = content.replace(/(doesn)'(t\b)/g, '$1&apos;$2');
  
  // Fix quotes in JSX text
  content = content.replace(/(\w)"(\w)/g, '$1&quot;$2');
  
  return content;
}

// Fix 2: Remove unused imports (basic patterns)
function removeUnusedImports(content) {
  const lines = content.split('\n');
  const usedImports = new Set();
  
  // Find all used identifiers in the file
  const codeContent = lines.join('\n');
  
  // Simple unused import removal for common patterns
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?/g;
  
  return content.replace(importRegex, (match, imports) => {
    const importList = imports.split(',').map(imp => imp.trim());
    const usedImportList = importList.filter(imp => {
      const cleanImp = imp.replace(/\s+as\s+\w+/, '');
      return codeContent.includes(cleanImp) && 
             codeContent.indexOf(cleanImp) !== codeContent.indexOf(match);
    });
    
    if (usedImportList.length === 0) {
      return ''; // Remove entire import line
    } else if (usedImportList.length < importList.length) {
      return match.replace(imports, usedImportList.join(', '));
    }
    return match;
  });
}

// Fix 3: Replace any types with unknown (safer)
function replaceAnyTypes(content) {
  // Replace function parameters with any
  content = content.replace(/(\w+):\s*any\b/g, '$1: unknown');
  
  // Replace variable declarations with any
  content = content.replace(/:\s*any\s*=/g, ': unknown =');
  
  return content;
}

// Fix 4: Fix empty interfaces
function fixEmptyInterfaces(content) {
  // Replace empty interfaces extending HTML attributes
  content = content.replace(
    /interface\s+(\w+Props)\s*extends\s+React\.(\w+HTMLAttributes<[^>]+>)\s*\{\s*\}/g,
    'type $1 = React.$2'
  );
  
  return content;
}

// Process files
const filesToFix = [
  'components/**/*.tsx',
  'app/**/*.tsx',
  'lib/**/*.ts',
  'components/**/*.ts'
];

let fixedFiles = 0;

filesToFix.forEach(pattern => {
  const files = glob.sync(pattern, { cwd: __dirname });
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Apply fixes
      content = fixUnescapedEntities(content);
      content = removeUnusedImports(content);
      content = replaceAnyTypes(content);
      content = fixEmptyInterfaces(content);
      
      // Only write if content changed
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${file}`);
        fixedFiles++;
      }
    } catch (error) {
      console.log(`❌ Error fixing ${file}:`, error.message);
    }
  });
});

console.log(`\n🎉 Fixed ${fixedFiles} files`);
console.log('📝 Run "npm run lint" to check remaining issues');