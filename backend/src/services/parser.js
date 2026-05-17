export function parseVoucherText(text = '') {
  const normalized = String(text);
  
  // Try to find code - prioritize patterns like "code ABC123" or "code: ABC123"
  let codeMatch = normalized.match(/voucher\s*code[:\s]+([A-Za-z0-9\-_]{3,15})/i);
  let code = null;
  
  if (codeMatch) {
    code = codeMatch[1];
  } else {
    // Try to find code on next line after "Voucher Code:" label
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (/voucher\s*code[:\s]*$/i.test(lines[i]) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextMatch = nextLine.match(/^([A-Za-z0-9\-_]{3,15})$/i);
        if (nextMatch) {
          code = nextMatch[1];
          break;
        }
      }
    }
  }
  
  if (!code) {
    // Fall back to finding alphanumeric strings that look like codes (excluding common words)
    const commonWords = /^(congrats|voucher|code|cashback|won|expir|today|tomorrow|vouchers)$/i;
    const matches = normalized.match(/\b[A-Z0-9\-_]{3,15}\b/g);
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
  
  // Priority 1: Look for currency symbols first (₹, Rs)
  let priceMatch = normalized.match(/Only\s+at\s*[₹Rs\.]*\s*(\d{1,6})/i);
  if (priceMatch) {
    value = Number(priceMatch[1]);
  }
  
  // Priority 2: Check for @ ₹999 or @ Rs999 pattern
  if (!value) {
    priceMatch = normalized.match(/@\s*[₹Rs\.]*\s*(\d{1,6})/i);
    if (priceMatch) value = Number(priceMatch[1]);
  }
  
  // Priority 3: Just currency symbol ₹999
  if (!value) {
    priceMatch = normalized.match(/[₹Rs\.]+\s*(\d{1,6})/i);
    if (priceMatch) value = Number(priceMatch[1]);
  }
  
  // Fallback: Take the first reasonable number if no currency symbol found
  if (!value) {
    const numMatches = normalized.match(/\d+/g);
    if (numMatches) {
      for (const numStr of numMatches) {
        const num = Number(numStr);
        if (num >= 1 && num <= 100000) {
          value = num;
          break;
        }
      }
    }
  }
  
  // Look for expiry dates
  let expiry = null;
  
  // Pattern 1: "Expiring in 15 days"
  let expiryMatch = normalized.match(/expir(?:ing|es)?\s+in\s+(\d+)\s+days?/i);
  if (expiryMatch) {
    expiry = `${expiryMatch[1]} days`;
  }
  
  // Pattern 2: Explicit dates or today/tomorrow
  if (!expiry) {
    expiryMatch = normalized.match(/(today|tomorrow|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
    if (expiryMatch) {
      expiry = expiryMatch[0];
    }
  }
  
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
    expiry: expiry,
    isLikelyValid: Boolean(code && expiry)
  };
}
