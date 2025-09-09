import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { selectorFinder } from '../src/content/selector-finder';

// Mock DOM environment
Object.defineProperty(window, 'getComputedStyle', {
  value: vi.fn().mockReturnValue({
    display: 'block',
    visibility: 'visible',
    opacity: '1'
  })
});

describe('Selector Finder', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Input Field Detection', () => {
    it('should find text input fields', () => {
      container.innerHTML = `
        <input type="text" id="username" />
        <input type="email" id="email" />
        <input type="password" id="password" />
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(3);
      expect(inputs.map(i => i.type)).toContain('text');
      expect(inputs.map(i => i.type)).toContain('email');
      expect(inputs.map(i => i.type)).toContain('password');
    });

    it('should find textarea elements', () => {
      container.innerHTML = `
        <textarea id="message" placeholder="Enter message"></textarea>
        <textarea id="description"></textarea>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(2);
      expect(inputs.every(i => i.tagName === 'TEXTAREA')).toBe(true);
    });

    it('should find contentEditable elements', () => {
      container.innerHTML = `
        <div contenteditable="true" id="editor1">Rich text editor</div>
        <div contenteditable="true" id="editor2"></div>
        <span contenteditable="plaintext-only">Plain text only</span>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(3);
      expect(inputs.every(i => i.contentEditable === 'true' || i.contentEditable === 'plaintext-only')).toBe(true);
    });

    it('should exclude hidden input fields', () => {
      container.innerHTML = `
        <input type="text" id="visible" />
        <input type="hidden" id="hidden" />
        <input type="text" style="display: none" id="display-none" />
        <input type="text" style="visibility: hidden" id="visibility-hidden" />
      `;

      vi.mocked(window.getComputedStyle).mockImplementation((element: Element) => {
        const el = element as HTMLElement;
        if (el.id === 'display-none') {
          return { display: 'none', visibility: 'visible', opacity: '1' } as CSSStyleDeclaration;
        }
        if (el.id === 'visibility-hidden') {
          return { display: 'block', visibility: 'hidden', opacity: '1' } as CSSStyleDeclaration;
        }
        return { display: 'block', visibility: 'visible', opacity: '1' } as CSSStyleDeclaration;
      });

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe('visible');
    });

    it('should exclude disabled input fields', () => {
      container.innerHTML = `
        <input type="text" id="enabled" />
        <input type="text" id="disabled" disabled />
        <textarea id="textarea-disabled" disabled></textarea>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe('enabled');
    });

    it('should exclude readonly input fields', () => {
      container.innerHTML = `
        <input type="text" id="editable" />
        <input type="text" id="readonly" readonly />
        <textarea id="textarea-readonly" readonly></textarea>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe('editable');
    });

    it('should find inputs in nested structures', () => {
      container.innerHTML = `
        <form>
          <div class="field-group">
            <label>Username</label>
            <input type="text" id="username" />
          </div>
          <div class="field-group">
            <label>Message</label>
            <textarea id="message"></textarea>
          </div>
        </form>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(2);
      expect(inputs.find(i => i.id === 'username')).toBeTruthy();
      expect(inputs.find(i => i.id === 'message')).toBeTruthy();
    });

    it('should handle shadow DOM', () => {
      const shadowHost = document.createElement('div');
      container.appendChild(shadowHost);
      
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `
        <input type="text" id="shadow-input" />
        <textarea id="shadow-textarea"></textarea>
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(2);
      expect(inputs.find(i => i.id === 'shadow-input')).toBeTruthy();
      expect(inputs.find(i => i.id === 'shadow-textarea')).toBeTruthy();
    });
  });

  describe('LLM Interface Detection', () => {
    it('should detect ChatGPT interface', () => {
      container.innerHTML = `
        <div class="chat-interface">
          <textarea placeholder="Send a message..." data-id="prompt-textarea"></textarea>
        </div>
      `;

      const isLLM = selectorFinder.isLLMInterface(container);
      expect(isLLM).toBe(true);
    });

    it('should detect Claude interface', () => {
      container.innerHTML = `
        <div class="claude-chat">
          <div contenteditable="true" data-testid="chat-input"></div>
        </div>
      `;

      const isLLM = selectorFinder.isLLMInterface(container);
      expect(isLLM).toBe(true);
    });

    it('should detect Gemini interface', () => {
      container.innerHTML = `
        <div class="gemini-interface">
          <textarea placeholder="Enter your prompt"></textarea>
        </div>
      `;

      const isLLM = selectorFinder.isLLMInterface(container);
      expect(isLLM).toBe(true);
    });

    it('should not detect regular forms as LLM interfaces', () => {
      container.innerHTML = `
        <form>
          <input type="text" placeholder="Username" />
          <input type="password" placeholder="Password" />
        </form>
      `;

      const isLLM = selectorFinder.isLLMInterface(container);
      expect(isLLM).toBe(false);
    });

    it('should detect based on URL patterns', () => {
      const originalLocation = window.location;
      
      // Mock location for ChatGPT
      Object.defineProperty(window, 'location', {
        value: { hostname: 'chat.openai.com' },
        writable: true
      });

      container.innerHTML = `<textarea></textarea>`;
      expect(selectorFinder.isLLMInterface(container)).toBe(true);

      // Mock location for Claude
      window.location = { hostname: 'claude.ai' } as Location;
      expect(selectorFinder.isLLMInterface(container)).toBe(true);

      // Mock location for regular site
      window.location = { hostname: 'example.com' } as Location;
      expect(selectorFinder.isLLMInterface(container)).toBe(false);

      // Restore original location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true
      });
    });

    it('should detect based on element attributes and classes', () => {
      container.innerHTML = `
        <div class="chat-container">
          <textarea class="prompt-textarea" data-prompt="true"></textarea>
        </div>
      `;

      const isLLM = selectorFinder.isLLMInterface(container);
      expect(isLLM).toBe(true);
    });
  });

  describe('Priority Detection', () => {
    it('should prioritize high-risk input fields', () => {
      container.innerHTML = `
        <input type="text" id="low-priority" />
        <input type="email" id="email-field" />
        <textarea placeholder="Enter your message to AI" id="ai-prompt"></textarea>
      `;

      const inputs = selectorFinder.findInputFields(container);
      const priorities = inputs.map(input => selectorFinder.getPriority(input));

      expect(priorities).toContain('high'); // AI prompt should be high priority
      expect(priorities).toContain('medium'); // Email field should be medium priority
      expect(priorities).toContain('low'); // Regular text input should be low priority
    });

    it('should identify password fields as high priority', () => {
      container.innerHTML = `<input type="password" id="password" />`;
      const inputs = selectorFinder.findInputFields(container);

      expect(selectorFinder.getPriority(inputs[0])).toBe('high');
    });

    it('should identify credit card fields as high priority', () => {
      container.innerHTML = `
        <input type="text" placeholder="Card number" />
        <input type="text" name="creditcard" />
        <input type="text" id="cc-number" />
      `;

      const inputs = selectorFinder.findInputFields(container);
      
      inputs.forEach(input => {
        expect(selectorFinder.getPriority(input)).toBe('high');
      });
    });

    it('should identify personal info fields as medium priority', () => {
      container.innerHTML = `
        <input type="email" name="email" />
        <input type="tel" name="phone" />
        <input type="text" name="firstname" />
        <input type="text" placeholder="Last name" />
      `;

      const inputs = selectorFinder.findInputFields(container);
      
      inputs.forEach(input => {
        expect(selectorFinder.getPriority(input)).toBe('medium');
      });
    });
  });

  describe('Submit Button Detection', () => {
    it('should find submit buttons', () => {
      container.innerHTML = `
        <button type="submit">Submit</button>
        <input type="submit" value="Send" />
        <button onclick="sendMessage()">Send Message</button>
      `;

      const buttons = selectorFinder.findSubmitButtons(container);

      expect(buttons).toHaveLength(3);
      expect(buttons.some(b => b.type === 'submit')).toBe(true);
      expect(buttons.some(b => b.textContent?.includes('Send'))).toBe(true);
    });

    it('should find buttons with submit-like text', () => {
      container.innerHTML = `
        <button>Send</button>
        <button>Submit</button>
        <button>Post</button>
        <button>Continue</button>
        <button>Next</button>
        <button>Cancel</button>
      `;

      const buttons = selectorFinder.findSubmitButtons(container);

      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.some(b => b.textContent?.toLowerCase().includes('send'))).toBe(true);
      expect(buttons.some(b => b.textContent?.toLowerCase().includes('submit'))).toBe(true);
      expect(buttons.some(b => b.textContent?.toLowerCase().includes('post'))).toBe(true);
    });

    it('should exclude disabled buttons', () => {
      container.innerHTML = `
        <button type="submit">Enabled Submit</button>
        <button type="submit" disabled>Disabled Submit</button>
      `;

      const buttons = selectorFinder.findSubmitButtons(container);

      expect(buttons).toHaveLength(1);
      expect(buttons[0].disabled).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle large DOM trees efficiently', () => {
      // Create a large DOM structure
      let html = '';
      for (let i = 0; i < 1000; i++) {
        html += `
          <div class="item-${i}">
            <input type="text" id="input-${i}" />
            <button>Button ${i}</button>
          </div>
        `;
      }
      container.innerHTML = html;

      const startTime = Date.now();
      const inputs = selectorFinder.findInputFields(container);
      const buttons = selectorFinder.findSubmitButtons(container);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(inputs).toHaveLength(1000);
      expect(buttons).toHaveLength(1000);
    });

    it('should cache results for repeated queries', () => {
      container.innerHTML = `
        <input type="text" id="test1" />
        <input type="email" id="test2" />
        <textarea id="test3"></textarea>
      `;

      // First call
      const startTime1 = Date.now();
      const inputs1 = selectorFinder.findInputFields(container);
      const duration1 = Date.now() - startTime1;

      // Second call (should be faster due to caching)
      const startTime2 = Date.now();
      const inputs2 = selectorFinder.findInputFields(container);
      const duration2 = Date.now() - startTime2;

      expect(inputs1).toHaveLength(3);
      expect(inputs2).toHaveLength(3);
      expect(duration2).toBeLessThanOrEqual(duration1); // Should be same or faster
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty containers', () => {
      const emptyDiv = document.createElement('div');
      
      const inputs = selectorFinder.findInputFields(emptyDiv);
      const buttons = selectorFinder.findSubmitButtons(emptyDiv);

      expect(inputs).toHaveLength(0);
      expect(buttons).toHaveLength(0);
    });

    it('should handle malformed HTML', () => {
      container.innerHTML = `
        <input type="text" id="unclosed"
        <textarea>Unclosed textarea
        <button>Unclosed button
      `;

      const inputs = selectorFinder.findInputFields(container);
      
      expect(Array.isArray(inputs)).toBe(true);
      // Should not crash and return some results
    });

    it('should handle special characters in selectors', () => {
      container.innerHTML = `
        <input type="text" id="field:with:colons" />
        <input type="text" class="field.with.dots" />
        <input type="text" name="field[with][brackets]" />
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(3);
      expect(inputs.every(i => i instanceof HTMLInputElement)).toBe(true);
    });

    it('should handle iframe content', () => {
      // Note: In a real browser environment, iframe content would need special handling
      // This test ensures the code doesn't crash when encountering iframes
      container.innerHTML = `
        <iframe src="about:blank">
          <input type="text" id="iframe-input" />
        </iframe>
        <input type="text" id="main-input" />
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(1); // Should find the main input
      expect(inputs[0].id).toBe('main-input');
    });

    it('should handle dynamically added elements', () => {
      container.innerHTML = `<div id="dynamic-container"></div>`;

      const dynamicContainer = container.querySelector('#dynamic-container')!;
      
      // Initially no inputs
      let inputs = selectorFinder.findInputFields(container);
      expect(inputs).toHaveLength(0);

      // Add input dynamically
      dynamicContainer.innerHTML = '<input type="text" id="dynamic-input" />';

      // Should find the new input
      inputs = selectorFinder.findInputFields(container);
      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe('dynamic-input');
    });
  });

  describe('Element Validation', () => {
    it('should validate element visibility correctly', () => {
      container.innerHTML = `
        <input type="text" id="visible" />
        <input type="text" id="zero-opacity" style="opacity: 0" />
        <input type="text" id="tiny-size" style="width: 1px; height: 1px" />
      `;

      vi.mocked(window.getComputedStyle).mockImplementation((element: Element) => {
        const el = element as HTMLElement;
        if (el.id === 'zero-opacity') {
          return { display: 'block', visibility: 'visible', opacity: '0' } as CSSStyleDeclaration;
        }
        return { display: 'block', visibility: 'visible', opacity: '1' } as CSSStyleDeclaration;
      });

      const inputs = selectorFinder.findInputFields(container);

      // Should exclude zero-opacity element but include others
      expect(inputs.some(i => i.id === 'visible')).toBe(true);
      expect(inputs.some(i => i.id === 'tiny-size')).toBe(true);
      expect(inputs.some(i => i.id === 'zero-opacity')).toBe(false);
    });

    it('should handle elements with complex CSS rules', () => {
      container.innerHTML = `
        <div style="position: relative;">
          <input type="text" id="positioned" style="position: absolute; top: 0; left: 0;" />
        </div>
        <input type="text" id="transformed" style="transform: translateX(100px);" />
      `;

      const inputs = selectorFinder.findInputFields(container);

      expect(inputs).toHaveLength(2);
      expect(inputs.find(i => i.id === 'positioned')).toBeTruthy();
      expect(inputs.find(i => i.id === 'transformed')).toBeTruthy();
    });
  });
});