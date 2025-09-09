export interface PIISpan {
  type: PIIType;
  start: number;
  end: number;
  text: string;
  confidence: number;
  source: 'regex' | 'deny-list' | 'ner';
}

export type PIIType = 
  | 'EMAIL' 
  | 'PHONE' 
  | 'IBAN' 
  | 'BIC' 
  | 'CARD' 
  | 'NAME' 
  | 'ADDRESS' 
  | 'POSTAL_CODE' 
  | 'URL' 
  | 'UUID' 
  | 'SSN' 
  | 'TAX_ID'
  | 'DATE_OF_BIRTH';

interface RegexPattern {
  type: PIIType;
  pattern: RegExp;
  confidence: number;
  validator?: (match: string) => boolean;
}

/**
 * Validates credit card number using Luhn algorithm
 */
function isValidCreditCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Validates IBAN checksum using mod-97 algorithm
 */
function isValidIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  if (cleanIban.length < 15 || cleanIban.length > 34) return false;
  
  // Move first 4 characters to end and convert letters to numbers
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
  const numericString = rearranged.replace(/[A-Z]/g, (char) => 
    (char.charCodeAt(0) - 55).toString()
  );
  
  // Calculate mod 97
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
  }
  
  return remainder === 1;
}

/**
 * Validates US SSN format and checks for known invalid patterns
 */
function isValidSSN(ssn: string): boolean {
  const cleanSSN = ssn.replace(/\D/g, '');
  if (cleanSSN.length !== 9) return false;
  
  // Invalid patterns
  if (cleanSSN === '000000000' || 
      cleanSSN === '123456789' ||
      cleanSSN.startsWith('000') ||
      cleanSSN.startsWith('666') ||
      cleanSSN.startsWith('9')) {
    return false;
  }
  
  return true;
}

/**
 * Comprehensive regex patterns for PII detection
 */
export const REGEX_PATTERNS: RegexPattern[] = [
  // Email addresses
  {
    type: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.95
  },
  
  // Phone numbers (international patterns)
  {
    type: 'PHONE',
    pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    confidence: 0.90
  },
  {
    type: 'PHONE',
    pattern: /\+(?:[0-9][-.\s]?){6,14}[0-9]\b/g,
    confidence: 0.85
  },
  
  // IBAN (International Bank Account Number)
  {
    type: 'IBAN',
    pattern: /\b[A-Z]{2}[0-9]{2}(?:\s?[0-9A-Z]{4}){2,8}\b/g,
    confidence: 0.95,
    validator: isValidIBAN
  },
  
  // BIC/SWIFT codes
  {
    type: 'BIC',
    pattern: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
    confidence: 0.90
  },
  
  // Credit card numbers
  {
    type: 'CARD',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    confidence: 0.95,
    validator: isValidCreditCard
  },
  {
    type: 'CARD',
    pattern: /\b(?:[0-9]{4}[-\s]?){3}[0-9]{4}\b/g,
    confidence: 0.80,
    validator: (match) => isValidCreditCard(match.replace(/[-\s]/g, ''))
  },
  
  // US Social Security Numbers
  {
    type: 'SSN',
    pattern: /\b[0-9]{3}-?[0-9]{2}-?[0-9]{4}\b/g,
    confidence: 0.90,
    validator: isValidSSN
  },
  
  // UUIDs
  {
    type: 'UUID',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    confidence: 0.95
  },
  
  // URLs
  {
    type: 'URL',
    pattern: /https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\._~!$&'()*+,;=:@]|%[0-9a-fA-F]{2})*)*(?:\?(?:[\w\._~!$&'()*+,;=:@/?]|%[0-9a-fA-F]{2})*)?(?:#(?:[\w\._~!$&'()*+,;=:@/?]|%[0-9a-fA-F]{2})*)?/g,
    confidence: 0.90
  },
  
  // Postal codes (US, DE, UK, CA)
  {
    type: 'POSTAL_CODE',
    pattern: /\b[0-9]{5}(?:-[0-9]{4})?\b/g, // US ZIP
    confidence: 0.70
  },
  {
    type: 'POSTAL_CODE',
    pattern: /\b[0-9]{5}\b/g, // German PLZ
    confidence: 0.65
  },
  {
    type: 'POSTAL_CODE',
    pattern: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}\b/gi, // UK postcodes
    confidence: 0.80
  },
  {
    type: 'POSTAL_CODE',
    pattern: /\b[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]\b/gi, // Canadian postal codes
    confidence: 0.85
  },
  
  // Date of birth patterns
  {
    type: 'DATE_OF_BIRTH',
    pattern: /\b(?:0[1-9]|1[0-2])[-\/](?:0[1-9]|[12][0-9]|3[01])[-\/](?:19|20)[0-9]{2}\b/g,
    confidence: 0.70
  },
  {
    type: 'DATE_OF_BIRTH',
    pattern: /\b(?:[1-2][0-9]|3[01]|0?[1-9])[-\/.](?:1[0-2]|0?[1-9])[-\/.](?:19|20)[0-9]{2}\b/g,
    confidence: 0.70
  },
  
  // German tax ID (Steueridentifikationsnummer)
  {
    type: 'TAX_ID',
    pattern: /\b[0-9]{11}\b/g,
    confidence: 0.60
  },
  
  // Austrian social security number
  {
    type: 'SSN',
    pattern: /\b[0-9]{4}\s?[0-9]{6}\b/g,
    confidence: 0.75
  },
  
  // Swiss social security number (AHV)
  {
    type: 'SSN',
    pattern: /\b756\.[0-9]{4}\.[0-9]{4}\.[0-9]{2}\b/g,
    confidence: 0.90
  }
];

/**
 * Detects PII using regex patterns
 */
export function detectPIIWithRegex(text: string): PIISpan[] {
  const spans: PIISpan[] = [];
  
  for (const pattern of REGEX_PATTERNS) {
    const regex = new RegExp(pattern.pattern);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      
      // Apply validator if present
      if (pattern.validator && !pattern.validator(matchText)) {
        continue;
      }
      
      // Skip very short matches that are likely false positives
      if (matchText.length < 3) continue;
      
      spans.push({
        type: pattern.type,
        start: match.index,
        end: match.index + matchText.length,
        text: matchText,
        confidence: pattern.confidence,
        source: 'regex'
      });
      
      // Prevent infinite loops with zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }
  
  return spans;
}

/**
 * Context-based confidence adjustment
 */
export function adjustConfidenceByContext(span: PIISpan, text: string): PIISpan {
  const beforeText = text.slice(Math.max(0, span.start - 20), span.start).toLowerCase();
  const afterText = text.slice(span.end, Math.min(text.length, span.end + 20)).toLowerCase();
  const context = beforeText + ' ' + afterText;
  
  let confidenceMultiplier = 1.0;
  
  // Boost confidence for relevant context keywords
  const contextBoosts: Partial<Record<PIIType, string[]>> = {
    EMAIL: ['email', 'mail', 'contact', 'send', 'write'],
    PHONE: ['phone', 'call', 'number', 'tel', 'mobile'],
    CARD: ['card', 'credit', 'payment', 'visa', 'mastercard'],
    IBAN: ['iban', 'account', 'bank', 'transfer'],
    SSN: ['ssn', 'social', 'security'],
    ADDRESS: ['address', 'street', 'city', 'zip'],
    NAME: ['name', 'called', 'mr', 'mrs', 'dr']
  };
  
  const relevantKeywords = contextBoosts[span.type] || [];
  const hasRelevantContext = relevantKeywords.some(keyword => 
    context.includes(keyword)
  );
  
  if (hasRelevantContext) {
    confidenceMultiplier = 1.2;
  }
  
  // Reduce confidence in certain contexts that suggest false positives
  const falsePositiveIndicators = [
    'example', 'test', 'demo', 'sample', 'placeholder', 
    'fake', 'dummy', 'xxx', '123', '000'
  ];
  
  const hasFalsePositiveIndicator = falsePositiveIndicators.some(indicator =>
    context.includes(indicator) || span.text.toLowerCase().includes(indicator)
  );
  
  if (hasFalsePositiveIndicator) {
    confidenceMultiplier = 0.5;
  }
  
  return {
    ...span,
    confidence: Math.min(0.99, span.confidence * confidenceMultiplier)
  };
}