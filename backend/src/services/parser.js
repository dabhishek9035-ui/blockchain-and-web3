export function parseVoucherText(text = '') {
  const normalized = String(text);
  
  // Try to find code - prioritize patterns like "code ABC123" or "code: ABC123"
  let codeMatch = normalized.match(/code[:\s]+([A-Z0-9]{3,12})/i);
  let code = null;
  
  if (codeMatch) {
    code = codeMatch[1];
  } else {
    // Fall back to finding alphanumeric strings that look like codes (excluding common words)
    const commonWords = /^(congrats|voucher|code|cashback|won|expir|today|tomorrow|vouchers)$/i;
    const matches = normalized.match(/\b[A-Z0-9]{3,12}\b/g);
    if (matches) {
      for (const m of matches) {
        if (!commonWords.test(m)) {
          code = m;
          break;
        }
      }
    }
  }
  
  // Look for any number that looks like a monetary value
  let value = null;
  const numMatches = normalized.match(/\d+/g);
  if (numMatches) {
    // Take the first number that's reasonable (between 1 and 100000)
    for (const numStr of numMatches) {
      const num = Number(numStr);
      if (num >= 1 && num <= 100000) {
        value = num;
        break;
      }
    }
  }
  
  // Look for expiry dates
  const expiryMatch = normalized.match(/(today|tomorrow|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  
  // Detect provider
  const provider = /gpay|google pay/i.test(normalized)
    ? 'GPay'
    : /phonepe/i.test(normalized)
      ? 'PhonePe'
      : /paytm/i.test(normalized)
        ? 'Paytm'
        : 'Unknown';

  return {
    provider,
    value: value,
    code: code ? code.toUpperCase() : null,
    expiry: expiryMatch ? expiryMatch[0] : null,
    isLikelyValid: Boolean(code && expiryMatch)
  };
}
