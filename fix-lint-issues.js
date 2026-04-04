#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing ESLint issues systematically...');

// Common unused imports to remove
const commonUnusedImports = [
  'randomBytes',
  'CheckCircle',
  'Shield', 
  'Lock',
  'Plus',
  'ArrowLeft',
  'X',
  'RadioGroup',
  'RadioGroupItem',
  'Calendar',
  'FileSection',
  'Badge',
  'useEffect',
  'auth',
  'redirect',
  'requireAuth',
  'firmManagementService'
];

// Files to process
const filesToProcess = [
  'app/actions/create-client-account.ts',
  'app/actions/delete-user.ts', 
  'app/actions/login.ts',
  'app/admin/layout.tsx',
  'components/additional-file-upload-form.tsx',
  'components/additional-service-request-form.tsx',
  'components/admin/AssignUserModal.tsx',
  'components/auth/RegistrationForm.tsx',
  'components/case-files-section.tsx',
  'components/case-list.tsx',
  'components/case-services-section.tsx',
  'components/ui/enhanced-file-upload.tsx',
  'lib/enhanced-email-service.ts',
  'lib/firm-management-service.ts',
  'lib/s3.ts'
];

function removeUnusedImport(content, importName) {
  // Remove from named imports
  const namedImportRegex = new RegExp(`import\\s*\\{([^}]*?)\\}\\s*from`, 'g');
  content = content.replace(namedImportRegex, (match, imports) => {
    const importList = imports.split(',').map(imp => imp.trim()).filter(imp => {
      const cleanImp = imp.replace(/\s+as\s+\w+/, '').trim();
      return cleanImp !== importName;
    });
    
    if (importList.length === 0) {
      return ''; // Remove entire import line
    }
    return `import { ${importList.join(', ')} } from`;
  });
  
  // Remove single imports
  const singleImportRegex = new RegExp(`import\\s+${importName}\\s+from\\s+['"'][^'"]+['"];?\\n?`, 'g');
  content = content.replace(singleImportRegex, '');
  
  return content;
}

function removeUnusedVariable(content, varName) {
  // Remove unused destructured variables
  const destructureRegex = new RegExp(`(\\{[^}]*?)\\b${varName}\\b,?([^}]*\\})`, 'g');
  content = content.replace(destructureRegex, (match, before, after) => {
    const cleaned = (before + after).replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
    return cleaned;
  });
  
  // Remove unused const declarations
  const constRegex = new RegExp(`\\s*const\\s+${varName}\\s*=.*?;?\\n`, 'g');
  content = content.replace(constRegex, '');
  
  return content;
}

function fixUnusedParameters(content) {
  // Add underscore prefix to unused parameters
  const patterns = [
    /(\w+):\s*(\w+)\s*\)\s*=>\s*{[\s\S]*?}/g, // Arrow functions
    /function\s+\w+\s*\(([^)]*)\)\s*{[\s\S]*?}/g // Regular functions
  ];
  
  patterns.forEach(pattern => {
    content = content.replace(pattern, (match) => {
      // Simple heuristic: if parameter name appears only once (in declaration), prefix with _
      const paramMatches = match.match(/(\w+):/g);
      if (paramMatches) {
        paramMatches.forEach(paramMatch => {
          const paramName = paramMatch.replace(':', '');
          const occurrences = (match.match(new RegExp(`\\b${paramName}\\b`, 'g')) || []).length;
          if (occurrences === 1) {
            match = match.replace(paramMatch, `_${paramMatch}`);
          }
        });
      }
      return match;
    });
  });
  
  return content;
}

// Process each file
let fixedCount = 0;

filesToProcess.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Remove common unused imports
    commonUnusedImports.forEach(importName => {
      content = removeUnusedImport(content, importName);
    });
    
    // Remove specific unused variables based on file
    if (filePath.includes('create-client-account.ts')) {
      content = removeUnusedVariable(content, 'temporaryPassword');
    }
    
    if (filePath.includes('enhanced-file-upload.tsx')) {
      content = removeUnusedVariable(content, 'showProgress');
      content = removeUnusedVariable(content, 'autoUpload');
    }
    
    // Fix unused parameters
    content = fixUnusedParameters(content);
    
    // Clean up empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Fixed: ${filePath}`);
      fixedCount++;
    }
  } catch (error) {
    console.log(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files automatically`);
console.log('📝 Run manual fixes for remaining issues...');