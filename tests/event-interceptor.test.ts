import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventInterceptor } from '../src/content/event-interceptor';

// Mock the PII detector
const mockMaskPII = vi.fn();
vi.mock('../src/pii/pii-detector', () => ({
  PIIDetector: vi.fn().mockImplementation(() => ({
    maskPII: mockMaskPII
  }))
}));

// Mock the logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Event Interceptor', () => {
  let container: HTMLDivElement;
  let mockSettings: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    mockSettings = {
      enabledTypes: new Set(['EMAIL', 'PHONE', 'CARD', 'NAME']),
      minConfidence: 0.7,
      useNER: true,
      useRegex: true,
      useDenyList: true,
      timeout: 5000
    };

    mockMaskPII.mockResolvedValue({
      maskedText: 'Masked content',
      spans: [],
      processingTime: 100
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    eventInterceptor.cleanup();
    document.body.innerHTML = '';
  });

  describe('Form Submit Interception', () => {
    it('should intercept form submissions', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="text" name="email" value="test@example.com" />
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;
      const submitEvent = vi.fn();

      // Initialize interceptor
      await eventInterceptor.initialize(mockSettings);

      // Attach event listener to verify interception
      form.addEventListener('submit', submitEvent);

      // Trigger form submission
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true); // Form submission should be prevented initially
    });

    it('should allow form submission after PII masking', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="text" name="message" value="Hello world" />
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;
      
      // Mock no PII detected
      mockMaskPII.mockResolvedValue({
        maskedText: 'Hello world',
        spans: [],
        processingTime: 50
      });

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockMaskPII).toHaveBeenCalled();
    });

    it('should mask PII before submission', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="text" name="email" value="test@example.com" />
          <textarea name="message">Contact me at test@example.com</textarea>
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;
      const input = form.querySelector('input[name="email"]') as HTMLInputElement;
      const textarea = form.querySelector('textarea[name="message"]') as HTMLTextAreaElement;

      mockMaskPII.mockResolvedValue({
        maskedText: '[[EMAIL]]',
        spans: [{ type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.95, source: 'regex' }],
        processingTime: 100
      });

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      // Wait for masking to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockMaskPII).toHaveBeenCalledWith('test@example.com', mockSettings);
      expect(mockMaskPII).toHaveBeenCalledWith('Contact me at test@example.com', mockSettings);
    });

    it('should handle form submission errors gracefully', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="text" name="field" value="test content" />
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;

      // Mock PII detection failure
      mockMaskPII.mockRejectedValue(new Error('Detection failed'));

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockMaskPII).toHaveBeenCalled();
      // Form should still be submittable even if PII detection fails
    });

    it('should skip processing for forms with no text inputs', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="hidden" name="id" value="123" />
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });
  });

  describe('Click Event Interception', () => {
    it('should intercept clicks on submit buttons', async () => {
      container.innerHTML = `
        <form id="test-form">
          <input type="text" name="content" value="test@example.com" />
          <button type="submit" id="submit-btn">Send Message</button>
        </form>
      `;

      const button = container.querySelector('#submit-btn')!;

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('click', { cancelable: true });
      button.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
    });

    it('should handle buttons with custom submit handlers', async () => {
      container.innerHTML = `
        <div>
          <textarea id="chat-input">Hello, my email is test@example.com</textarea>
          <button id="send-btn" data-action="send">Send</button>
        </div>
      `;

      const button = container.querySelector('#send-btn')!;

      await eventInterceptor.initialize(mockSettings);

      const event = new Event('click', { cancelable: true });
      button.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
    });

    it('should not intercept non-submit buttons', async () => {
      container.innerHTML = `
        <div>
          <button id="cancel-btn">Cancel</button>
          <button id="help-btn">Help</button>
        </div>
      `;

      const cancelBtn = container.querySelector('#cancel-btn')!;
      const helpBtn = container.querySelector('#help-btn')!;

      await eventInterceptor.initialize(mockSettings);

      const cancelEvent = new Event('click', { cancelable: true });
      const helpEvent = new Event('click', { cancelable: true });

      cancelBtn.dispatchEvent(cancelEvent);
      helpBtn.dispatchEvent(helpEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Interception', () => {
    it('should intercept Enter key in input fields', async () => {
      container.innerHTML = `
        <div>
          <textarea id="chat-input">My phone is 555-1234</textarea>
        </div>
      `;

      const textarea = container.querySelector('#chat-input')!;

      await eventInterceptor.initialize(mockSettings);

      const event = new KeyboardEvent('keydown', { 
        key: 'Enter', 
        cancelable: true,
        ctrlKey: true // Ctrl+Enter common for submission
      });
      
      textarea.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalledWith('My phone is 555-1234', mockSettings);
    });

    it('should not intercept non-submission keypresses', async () => {
      container.innerHTML = `
        <input type="text" id="normal-input" value="typing..." />
      `;

      const input = container.querySelector('#normal-input')!;

      await eventInterceptor.initialize(mockSettings);

      // Regular typing
      const typeEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        cancelable: true 
      });
      
      input.dispatchEvent(typeEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });

    it('should handle Ctrl+Enter in textareas', async () => {
      container.innerHTML = `
        <textarea placeholder="Type your message...">Contact john@example.com</textarea>
      `;

      const textarea = container.querySelector('textarea')!;

      await eventInterceptor.initialize(mockSettings);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        cancelable: true
      });

      textarea.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
    });
  });

  describe('Dynamic Content Handling', () => {
    it('should handle dynamically added forms', async () => {
      await eventInterceptor.initialize(mockSettings);

      // Add form after initialization
      container.innerHTML = `
        <form id="dynamic-form">
          <input type="text" name="email" value="new@example.com" />
          <input type="submit" value="Submit" />
        </form>
      `;

      const form = container.querySelector('form')!;

      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
    });

    it('should observe DOM mutations for new elements', async () => {
      await eventInterceptor.initialize(mockSettings);

      // Simulate dynamic content loading
      const newDiv = document.createElement('div');
      newDiv.innerHTML = `
        <form>
          <textarea>Tell me about test@example.com</textarea>
          <button type="submit">Send</button>
        </form>
      `;
      
      container.appendChild(newDiv);

      // Give MutationObserver time to detect changes
      await new Promise(resolve => setTimeout(resolve, 100));

      const button = newDiv.querySelector('button')!;
      const clickEvent = new Event('click', { cancelable: true });
      button.dispatchEvent(clickEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalled();
    });
  });

  describe('Settings Integration', () => {
    it('should respect disabled PII types', async () => {
      const limitedSettings = {
        ...mockSettings,
        enabledTypes: new Set(['EMAIL']) // Only EMAIL enabled
      };

      container.innerHTML = `
        <form>
          <input type="text" value="test@example.com and 555-1234" />
          <input type="submit" />
        </form>
      `;

      await eventInterceptor.initialize(limitedSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalledWith(
        'test@example.com and 555-1234', 
        limitedSettings
      );
    });

    it('should handle settings updates', async () => {
      container.innerHTML = `
        <form>
          <input type="text" value="test content" />
          <input type="submit" />
        </form>
      `;

      await eventInterceptor.initialize(mockSettings);

      // Update settings
      const newSettings = { ...mockSettings, minConfidence: 0.9 };
      eventInterceptor.updateSettings(newSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalledWith('test content', newSettings);
    });

    it('should handle disabled interceptor', async () => {
      const disabledSettings = { ...mockSettings, enabled: false };

      container.innerHTML = `
        <form>
          <input type="text" value="test@example.com" />
          <input type="submit" />
        </form>
      `;

      await eventInterceptor.initialize(disabledSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle multiple rapid form submissions', async () => {
      container.innerHTML = `
        <form id="perf-test">
          <input type="text" name="content" value="test@example.com" />
          <input type="submit" />
        </form>
      `;

      const form = container.querySelector('form')!;

      await eventInterceptor.initialize(mockSettings);

      const startTime = Date.now();

      // Submit form 10 times rapidly
      for (let i = 0; i < 10; i++) {
        const event = new Event('submit', { cancelable: true });
        form.dispatchEvent(event);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should handle rapid submissions efficiently
      expect(mockMaskPII).toHaveBeenCalled(); // Should have processed at least some
    });

    it('should debounce rapid events', async () => {
      container.innerHTML = `
        <button id="rapid-click">Send</button>
        <textarea>test content</textarea>
      `;

      const button = container.querySelector('#rapid-click')!;

      await eventInterceptor.initialize(mockSettings);

      // Rapidly click button
      for (let i = 0; i < 5; i++) {
        const event = new Event('click', { cancelable: true });
        button.dispatchEvent(event);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have debounced to fewer calls than clicks
      expect(mockMaskPII).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed DOM gracefully', async () => {
      // Create problematic DOM structure
      container.innerHTML = `
        <form>
          <input type="text" value="test@example.com">
          <!-- Malformed HTML -->
        </form>
      `;

      await eventInterceptor.initialize(mockSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });

      expect(() => {
        form.dispatchEvent(event);
      }).not.toThrow();
    });

    it('should continue working after PII detection errors', async () => {
      container.innerHTML = `
        <form>
          <input type="text" name="field1" value="content1" />
          <input type="text" name="field2" value="content2" />
          <input type="submit" />
        </form>
      `;

      // First call fails, second succeeds
      mockMaskPII
        .mockRejectedValueOnce(new Error('First call failed'))
        .mockResolvedValueOnce({
          maskedText: 'content2',
          spans: [],
          processingTime: 50
        });

      await eventInterceptor.initialize(mockSettings);

      const form = container.querySelector('form')!;
      
      // First submission (should handle error)
      const event1 = new Event('submit', { cancelable: true });
      form.dispatchEvent(event1);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Second submission (should work)
      const event2 = new Event('submit', { cancelable: true });
      form.dispatchEvent(event2);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).toHaveBeenCalledTimes(4); // 2 fields × 2 submissions
    });
  });

  describe('User Notification', () => {
    it('should provide feedback when PII is detected', async () => {
      container.innerHTML = `
        <form>
          <input type="text" value="My email is test@example.com" />
          <input type="submit" />
        </form>
      `;

      mockMaskPII.mockResolvedValue({
        maskedText: 'My email is [[EMAIL]]',
        spans: [{ type: 'EMAIL', text: 'test@example.com', start: 11, end: 27, confidence: 0.95, source: 'regex' }],
        processingTime: 100
      });

      await eventInterceptor.initialize(mockSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should show user notification when PII is detected and masked
      const notification = document.querySelector('.pii-notification');
      expect(notification).toBeTruthy();
    });

    it('should allow user to override PII masking', async () => {
      container.innerHTML = `
        <form>
          <input type="text" value="Share my email: test@example.com" />
          <input type="submit" />
        </form>
      `;

      mockMaskPII.mockResolvedValue({
        maskedText: 'Share my email: [[EMAIL]]',
        spans: [{ type: 'EMAIL', text: 'test@example.com', start: 16, end: 32, confidence: 0.95, source: 'regex' }],
        processingTime: 100
      });

      await eventInterceptor.initialize(mockSettings);

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 200));

      // User should have option to proceed with original text
      const proceedButton = document.querySelector('.proceed-anyway');
      expect(proceedButton).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should remove all event listeners on cleanup', async () => {
      container.innerHTML = `
        <form>
          <input type="text" value="test" />
          <input type="submit" />
        </form>
      `;

      await eventInterceptor.initialize(mockSettings);

      // Cleanup
      eventInterceptor.cleanup();

      const form = container.querySelector('form')!;
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });

    it('should stop mutation observer on cleanup', async () => {
      await eventInterceptor.initialize(mockSettings);

      eventInterceptor.cleanup();

      // Add new content after cleanup
      container.innerHTML = `
        <form>
          <input type="text" value="test@example.com" />
          <button type="submit">Send</button>
        </form>
      `;

      const button = container.querySelector('button')!;
      const event = new Event('click', { cancelable: true });
      button.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMaskPII).not.toHaveBeenCalled();
    });
  });
});