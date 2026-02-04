
function isPrivateIP(ip) {
  // Remove brackets for IPv6
  ip = ip.replace(/^\[|\]$/g, '');
  
  // IPv4 private ranges
  const ipv4PrivateRanges = [
    /^127\./,                   
    /^10\./,                     
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, 
    /^192\.168\./,              
    /^169\.254\./,               
    /^0\./,                     
    /^224\./,                   
    /^240\./,                   
    /^255\.255\.255\.255$/       
  ];
  
  // Check IPv4 private ranges
  for (const range of ipv4PrivateRanges) {
    if (range.test(ip)) {
      return true;
    }
  }
  
  // IPv6 private/special addresses
  // Using specific patterns instead of complex quantifiers to prevent ReDoS
  const ipv6PrivateRanges = [
    /^::1$/,                   
    /^::$/,                      
    /^::ffff:/i,                 
    /^fe80:/i,                   
    /^fc00:/i,                  
    /^fd00:/i                    
  ];
  
  const ipLower = ip.toLowerCase();
  for (const range of ipv6PrivateRanges) {
    if (range.test(ipLower)) {
      return true;
    }
  }
  
  return false;
}

function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }
  
  // Trim the URL
  urlString = urlString.trim();
  
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only http and https protocols are allowed' };
  }
  
  
  // This prevents URL confusion attacks
  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed' };
  }
  
  // Check for localhost
  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return { valid: false, error: 'Localhost addresses are not allowed' };
  }
  
  // Block cloud metadata service endpoints
  
  const blockedHostnames = [
    '169.254.169.254',            // AWS/Azure/GCP metadata IP
    'metadata.google.internal',   // GCP metadata hostname
    'instance-data',              // AWS instance metadata
    'metadata',                   // Generic metadata hostname
  ];
  
  if (blockedHostnames.includes(hostname)) {
    return { valid: false, error: 'Access to cloud metadata services is not allowed' };
  }
  
  // Check if hostname is an IP address and if it's private
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Simplified IPv6 pattern - proper validation done by URL parser already
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  
  if (ipv4Pattern.test(hostname) || (ipv6Pattern.test(hostname) && hostname.includes(':')) || hostname.startsWith('[')) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
  }
  
  // Block URLs with @ symbol that could be used for confusion attacks
 
  if (urlString.includes('@') && !parsedUrl.username) {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  // Validate that the hostname contains only valid characters
  // This prevents DNS rebinding and other exotic attacks
  // Use atomic grouping equivalent to prevent ReDoS: limit consecutive dots/hyphens
  const validHostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const isIPAddress = ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname) || hostname.startsWith('[');
  
  // Additional length check to prevent DoS
  if (hostname.length > 253) {
    return { valid: false, error: 'Hostname too long' };
  }
  
  if (!isIPAddress && !validHostnamePattern.test(hostname)) {
    return { valid: false, error: 'Invalid hostname format' };
  }
  
  return { valid: true, url: parsedUrl };
}

module.exports = { validateUrl, isPrivateIP };
