export interface SiteConfig {
  name: string;
  hostPatterns: RegExp[];
  selectors: {
    input: string[];
    sendButton: string[];
    chatContainer?: string[];
  };
  fallbacks?: {
    input?: string[];
    sendButton?: string[];
  };
}

export const SITE_CONFIGS: SiteConfig[] = [
  {
    name: 'ChatGPT',
    hostPatterns: [/chat\.openai\.com/, /chatgpt\.com/],
    selectors: {
      input: [
        'textarea[data-id="root"]',
        '#prompt-textarea',
        'textarea[placeholder*="Send a message"]',
        'div[contenteditable="true"][data-id="root"]'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[data-testid="fruitjuice-send-button"]',
        'button[aria-label*="Send"]',
        'button:has(svg[data-icon="arrow-right"])',
        'form button[type="submit"]:last-child'
      ],
      chatContainer: [
        '[data-testid="conversation-turn-"]',
        '.conversation-content',
        '[role="main"] > div > div'
      ]
    },
    fallbacks: {
      input: [
        'textarea:not([readonly]):not([disabled])',
        'div[contenteditable="true"]:not([aria-label*="Search"])'
      ],
      sendButton: [
        'button:has(svg)',
        'button[type="submit"]',
        'form button:last-child'
      ]
    }
  },
  {
    name: 'Claude',
    hostPatterns: [/claude\.ai/],
    selectors: {
      input: [
        'div[contenteditable="true"][data-testid="conversation-input"]',
        'div[contenteditable="true"]:not([aria-label*="Search"])',
        'textarea[placeholder*="Talk to Claude"]'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send Message"]',
        'button:has(svg[data-icon="send"])',
        'form button[type="submit"]'
      ],
      chatContainer: [
        '[data-testid="conversation"]',
        '[data-testid="chat-messages"]',
        'main [role="log"]'
      ]
    },
    fallbacks: {
      input: [
        'div[contenteditable="true"]:not([aria-label*="Search"]):not([aria-label*="Filter"])',
        'textarea:not([readonly]):not([disabled])'
      ],
      sendButton: [
        'button:has(svg)',
        'form button:last-child'
      ]
    }
  },
  {
    name: 'OpenAI Chat',
    hostPatterns: [/chat\.openai\.com/],
    selectors: {
      input: [
        'textarea[data-id="root"]',
        'textarea[placeholder*="Send a message"]'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]'
      ]
    }
  }
];

export function getSiteConfig(hostname: string): SiteConfig | null {
  return SITE_CONFIGS.find(config => 
    config.hostPatterns.some(pattern => pattern.test(hostname))
  ) || null;
}

export function findElements(selectors: string[], root: Document | Element = document): Element[] {
  const elements: Element[] = [];
  
  for (const selector of selectors) {
    try {
      const found = root.querySelectorAll(selector);
      elements.push(...Array.from(found));
    } catch (error) {
      console.warn(`[PII Checker] Invalid selector: ${selector}`, error);
    }
  }
  
  return elements.filter((el, index, arr) => arr.indexOf(el) === index);
}

export function findElement(selectors: string[], root: Document | Element = document): Element | null {
  const elements = findElements(selectors, root);
  return elements.length > 0 ? elements[0] : null;
}