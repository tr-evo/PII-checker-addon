import { PIISpan, PIIType } from './regex-recognizers';

interface DenyListPattern {
  type: PIIType;
  patterns: string[];
  confidence: number;
  caseSensitive?: boolean;
}

/**
 * Known sensitive patterns that should be blocked
 * Based on Microsoft Presidio recognizers and common sensitive identifiers
 */
const DENY_LIST_PATTERNS: DenyListPattern[] = [
  // Common test/example email patterns
  {
    type: 'EMAIL',
    patterns: [
      'test@test.com',
      'example@example.com',
      'user@domain.com',
      'admin@company.com',
      'noreply@company.com'
    ],
    confidence: 0.99
  },
  
  // Known invalid but structured SSNs
  {
    type: 'SSN',
    patterns: [
      '123-45-6789',
      '000-00-0000',
      '999-99-9999',
      '111-11-1111',
      '222-22-2222',
      '333-33-3333',
      '444-44-4444',
      '555-55-5555',
      '666-66-6666',
      '777-77-7777',
      '888-88-8888'
    ],
    confidence: 0.98
  },
  
  // Test credit card numbers
  {
    type: 'CARD',
    patterns: [
      '4111111111111111', // Visa test number
      '4000000000000002', // Visa test number
      '5555555555554444', // Mastercard test number
      '5200000000000007', // Mastercard test number
      '378282246310005',  // Amex test number
      '371449635398431',  // Amex test number
      '6011111111111117', // Discover test number
      '6011000990139424'  // Discover test number
    ],
    confidence: 0.99
  },
  
  // German tax ID patterns (Steueridentifikationsnummer)
  {
    type: 'TAX_ID',
    patterns: [
      '12345678901', // Invalid pattern
      '00000000000',  // All zeros
      '11111111111'   // All ones
    ],
    confidence: 0.95
  },
  
  // IBAN test patterns
  {
    type: 'IBAN',
    patterns: [
      'DE89 3704 0044 0532 0130 00', // Deutsche Bank example
      'GB29 NWBK 6016 1331 9268 19', // UK example
      'FR14 2004 1010 0505 0001 3M02 606', // France example
      'IT60 X054 2811 1010 0000 0123 456'  // Italy example
    ],
    confidence: 0.98
  },
  
  // Common UUID patterns used in examples
  {
    type: 'UUID',
    patterns: [
      '123e4567-e89b-12d3-a456-426614174000',
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111'
    ],
    confidence: 0.95
  },
  
  // Common names that should be flagged (high-profile individuals)
  {
    type: 'NAME',
    patterns: [
      'John Doe',
      'Jane Doe',
      'John Smith',
      'Jane Smith',
      // Add more sensitive names as needed - could be loaded from external config
    ],
    confidence: 0.80,
    caseSensitive: false
  },
  
  // Sensitive URLs that should be masked
  {
    type: 'URL',
    patterns: [
      'https://admin.company.com',
      'https://internal.company.com',
      'https://staging.company.com',
      'https://dev.company.com'
    ],
    confidence: 0.90,
    caseSensitive: false
  }
];

/**
 * Company/organization specific patterns
 * These would be configurable in enterprise deployments
 */
interface CompanyDenyList {
  companyId: string;
  patterns: DenyListPattern[];
}

const COMPANY_DENY_LISTS: CompanyDenyList[] = [
  // Example company patterns - these would be loaded from configuration
  {
    companyId: 'example-corp',
    patterns: [
      {
        type: 'EMAIL',
        patterns: [
          '@company.internal',
          '@corp.local'
        ],
        confidence: 0.99
      },
      {
        type: 'TAX_ID',
        patterns: [
          'COMP-12345', // Custom company ID format
          'EMP-'        // Employee ID prefix
        ],
        confidence: 0.95
      }
    ]
  }
];

/**
 * Detects PII using deny-list patterns
 */
export function detectPIIWithDenyList(
  text: string, 
  companyId?: string
): PIISpan[] {
  const spans: PIISpan[] = [];
  let allPatterns = [...DENY_LIST_PATTERNS];
  
  // Add company-specific patterns if specified
  if (companyId) {
    const companyPatterns = COMPANY_DENY_LISTS.find(
      cl => cl.companyId === companyId
    );
    if (companyPatterns) {
      allPatterns = [...allPatterns, ...companyPatterns.patterns];
    }
  }
  
  for (const denyList of allPatterns) {
    for (const pattern of denyList.patterns) {
      const searchText = denyList.caseSensitive === false ? 
        text.toLowerCase() : text;
      const searchPattern = denyList.caseSensitive === false ? 
        pattern.toLowerCase() : pattern;
      
      let startIndex = 0;
      let foundIndex: number;
      
      while ((foundIndex = searchText.indexOf(searchPattern, startIndex)) !== -1) {
        // Get the original case text
        const originalText = text.slice(foundIndex, foundIndex + pattern.length);
        
        spans.push({
          type: denyList.type,
          start: foundIndex,
          end: foundIndex + pattern.length,
          text: originalText,
          confidence: denyList.confidence,
          source: 'deny-list'
        });
        
        startIndex = foundIndex + 1;
      }
    }
  }
  
  return spans;
}

/**
 * Checks if a specific pattern is in the deny list
 */
export function isInDenyList(
  text: string, 
  type: PIIType, 
  companyId?: string
): boolean {
  const spans = detectPIIWithDenyList(text, companyId);
  return spans.some(span => 
    span.type === type && 
    span.text.toLowerCase() === text.toLowerCase()
  );
}

/**
 * Adds custom deny-list patterns (for enterprise usage)
 */
export function addCustomDenyListPatterns(
  companyId: string,
  patterns: DenyListPattern[]
): void {
  const existingCompany = COMPANY_DENY_LISTS.find(cl => cl.companyId === companyId);
  
  if (existingCompany) {
    existingCompany.patterns.push(...patterns);
  } else {
    COMPANY_DENY_LISTS.push({
      companyId,
      patterns
    });
  }
}

/**
 * Removes custom deny-list patterns
 */
export function removeCustomDenyListPatterns(companyId: string): void {
  const index = COMPANY_DENY_LISTS.findIndex(cl => cl.companyId === companyId);
  if (index !== -1) {
    COMPANY_DENY_LISTS.splice(index, 1);
  }
}

/**
 * Gets all deny-list patterns for a company
 */
export function getDenyListPatterns(companyId?: string): DenyListPattern[] {
  let patterns = [...DENY_LIST_PATTERNS];
  
  if (companyId) {
    const companyPatterns = COMPANY_DENY_LISTS.find(cl => cl.companyId === companyId);
    if (companyPatterns) {
      patterns = [...patterns, ...companyPatterns.patterns];
    }
  }
  
  return patterns;
}