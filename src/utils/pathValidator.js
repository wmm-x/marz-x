const path = require('path');

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }

  // Remove any directory path components
  filename = path.basename(filename);

  // Remove or replace dangerous characters
  // Allow: letters, numbers, dots, hyphens, underscores
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent hidden files
  if (filename.startsWith('.')) {
    filename = '_' + filename.slice(1);
  }

  // Prevent empty filename
  if (!filename || filename.length === 0) {
    throw new Error('Filename cannot be empty after sanitization');
  }

  // Limit filename length
  if (filename.length > 255) {
    filename = filename.slice(0, 255);
  }

  return filename;
}

function validatePathWithinRoot(filePath, rootDir) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'File path must be a non-empty string' };
  }

  if (!rootDir || typeof rootDir !== 'string') {
    return { valid: false, error: 'Root directory must be a non-empty string' };
  }

  try {
    // Normalize both paths to resolve any .. or . components
    const normalizedRoot = path.resolve(rootDir);
    const normalizedPath = path.resolve(filePath);

    // Check if the normalized path starts with the root directory
    // Use path.relative to check containment
    const relative = path.relative(normalizedRoot, normalizedPath);

    // If relative path starts with .. or is absolute, it's outside the root
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { 
        valid: false, 
        error: 'Path is outside the allowed directory' 
      };
    }

    return { 
      valid: true, 
      normalizedPath: normalizedPath 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Invalid path: ' + error.message 
    };
  }
}


function validateFileAgainstAllowlist(filename, allowList) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename must be a non-empty string' };
  }

  if (!Array.isArray(allowList) || allowList.length === 0) {
    return { valid: false, error: 'Allowlist must be a non-empty array' };
  }

  const basename = path.basename(filename);

  for (const pattern of allowList) {
    if (pattern instanceof RegExp) {
      if (pattern.test(basename)) {
        return { valid: true };
      }
    } else if (typeof pattern === 'string') {
      if (basename === pattern) {
        return { valid: true };
      }
    }
  }

  return { 
    valid: false, 
    error: 'Filename does not match any allowed pattern' 
  };
}

module.exports = {
  sanitizeFilename,
  validatePathWithinRoot,
  validateFileAgainstAllowlist
};
