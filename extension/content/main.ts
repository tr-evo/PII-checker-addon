import { getSiteConfig, findElement, SiteConfig } from '../../src/selectors/sites';
import { piiWorkerClient } from '../../src/pii/pii-worker-client';
import type { PIIDetectionOptions } from '../../src/pii/pii-detector';

interface InterceptorState {
  inputElement: HTMLElement | null;
  sendButton: HTMLElement | null;
  isProcessing: boolean;
  keydownHandler: ((e: KeyboardEvent) => void) | null;
  clickHandler: ((e: MouseEvent) => void) | null;
}

class PIIInterceptor {
  private config: SiteConfig | null;
  private state: InterceptorState;
  private observer: MutationObserver | null = null;
  private retryCount = 0;
  private readonly maxRetries = 10;
  private readonly retryDelay = 1000;

  constructor() {
    this.config = getSiteConfig(window.location.hostname);
    this.state = {
      inputElement: null,
      sendButton: null,
      isProcessing: false,
      keydownHandler: null,
      clickHandler: null
    };

    console.log(`[PII Checker] Content script loaded on ${window.location.hostname}`);
    
    if (!this.config) {
      console.warn(`[PII Checker] No configuration found for ${window.location.hostname}`);
      return;
    }

    console.log(`[PII Checker] Using configuration for ${this.config.name}`);
    
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.init();
    
    // Preload PII detection models in the background
    this.preloadPIIModels();
  }

  private init(): void {
    // Initial setup
    this.setupInterceptors();
    
    // Start observing DOM changes
    this.observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled']
    });

    // Retry setup periodically for SPA navigation
    this.scheduleRetry();
  }

  private handleMutations(mutations: MutationRecord[]): void {
    let shouldResetup = false;

    for (const mutation of mutations) {
      // Check if our tracked elements were removed
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        for (const node of Array.from(mutation.removedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (this.state.inputElement && (element.contains(this.state.inputElement) || element === this.state.inputElement)) {
              shouldResetup = true;
            }
            if (this.state.sendButton && (element.contains(this.state.sendButton) || element === this.state.sendButton)) {
              shouldResetup = true;
            }
          }
        }
      }

      // Check if new elements were added that might be relevant
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // Check if this could be a new input or send button
            if (this.config && this.matchesSelectors(element, [...this.config.selectors.input, ...this.config.selectors.sendButton])) {
              shouldResetup = true;
            }
          }
        }
      }
    }

    if (shouldResetup) {
      console.log('[PII Checker] DOM changed, re-setting up interceptors');
      this.cleanupHandlers();
      setTimeout(() => this.setupInterceptors(), 100);
    }
  }

  private matchesSelectors(element: Element, selectors: string[]): boolean {
    return selectors.some(selector => {
      try {
        return element.matches(selector) || element.querySelector(selector) !== null;
      } catch {
        return false;
      }
    });
  }

  private setupInterceptors(): void {
    if (!this.config) return;

    // Find input element
    const inputElement = findElement(this.config.selectors.input) || 
                        (this.config.fallbacks?.input ? findElement(this.config.fallbacks.input) : null);
    
    // Find send button
    const sendButton = findElement(this.config.selectors.sendButton) ||
                      (this.config.fallbacks?.sendButton ? findElement(this.config.fallbacks.sendButton) : null);

    if (inputElement && sendButton) {
      this.state.inputElement = inputElement as HTMLElement;
      this.state.sendButton = sendButton as HTMLElement;
      
      console.log('[PII Checker] Found input and send elements, setting up interception');
      this.attachHandlers();
      this.retryCount = 0; // Reset retry count on success
    } else {
      console.log(`[PII Checker] Missing elements - Input: ${!!inputElement}, Send: ${!!sendButton}`);
      if (this.retryCount < this.maxRetries) {
        this.scheduleRetry();
      }
    }
  }

  private scheduleRetry(): void {
    if (this.retryCount < this.maxRetries) {
      setTimeout(() => {
        this.retryCount++;
        console.log(`[PII Checker] Retry ${this.retryCount}/${this.maxRetries} finding elements`);
        this.setupInterceptors();
      }, this.retryDelay);
    }
  }

  private attachHandlers(): void {
    if (!this.state.inputElement || !this.state.sendButton) return;

    this.cleanupHandlers(); // Clean up any existing handlers

    // Create keydown handler for Enter key
    this.state.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !this.state.isProcessing) {
        console.log('[PII Checker] Enter key intercepted');
        e.preventDefault();
        e.stopPropagation();
        this.handleSubmit();
      }
    };

    // Create click handler for send button
    this.state.clickHandler = (e: MouseEvent) => {
      if (!this.state.isProcessing) {
        console.log('[PII Checker] Send button click intercepted');
        e.preventDefault();
        e.stopPropagation();
        this.handleSubmit();
      }
    };

    // Attach handlers with high priority (capture phase)
    this.state.inputElement.addEventListener('keydown', this.state.keydownHandler, { capture: true });
    this.state.sendButton.addEventListener('click', this.state.clickHandler, { capture: true });

    console.log('[PII Checker] Event handlers attached');
  }

  private cleanupHandlers(): void {
    if (this.state.keydownHandler && this.state.inputElement) {
      this.state.inputElement.removeEventListener('keydown', this.state.keydownHandler, { capture: true });
      this.state.keydownHandler = null;
    }

    if (this.state.clickHandler && this.state.sendButton) {
      this.state.sendButton.removeEventListener('click', this.state.clickHandler, { capture: true });
      this.state.clickHandler = null;
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.state.inputElement || !this.state.sendButton || this.state.isProcessing) {
      return;
    }

    try {
      this.state.isProcessing = true;
      this.disableSendButton();

      // Get input text
      const inputText = this.getInputText();
      if (!inputText.trim()) {
        console.log('[PII Checker] Empty input, allowing normal submission');
        this.triggerOriginalSubmit();
        return;
      }

      console.log('[PII Checker] Processing input text for PII masking...');
      
      // Get PII detection options (could be loaded from storage)
      const options: PIIDetectionOptions = {
        minConfidence: 0.7,
        useNER: true,
        useDenyList: true,
        useRegex: true,
        timeout: 5000
      };
      
      try {
        // Perform PII masking using the worker
        const result = await piiWorkerClient.maskText(inputText, options);
        
        if (result.spans.length > 0) {
          console.log(`[PII Checker] Found ${result.spans.length} PII spans, replacing with masked text`);
          
          // Replace the input text with masked version
          this.setInputText(result.maskedText);
          
          // Show user notification about masking
          this.showMaskingNotification(result.spans.length);
        } else {
          console.log('[PII Checker] No PII detected, proceeding with original text');
        }
        
        // Proceed with sending (original or masked)
        this.triggerOriginalSubmit();
        
      } catch (error) {
        console.error('[PII Checker] PII masking failed:', error);
        this.showError(`PII masking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Still allow sending in case of failure
        this.triggerOriginalSubmit();
      }
      
    } catch (error) {
      console.error('[PII Checker] Error during submit handling:', error);
      this.showError('PII processing failed. Click to send anyway.');
      this.triggerOriginalSubmit();
    } finally {
      this.state.isProcessing = false;
      this.enableSendButton();
    }
  }

  private getInputText(): string {
    if (!this.state.inputElement) return '';

    // Handle both textarea and contenteditable elements
    if (this.state.inputElement.tagName === 'TEXTAREA') {
      return (this.state.inputElement as HTMLTextAreaElement).value;
    } else if (this.state.inputElement.contentEditable === 'true') {
      return this.state.inputElement.textContent || '';
    } else {
      return (this.state.inputElement as HTMLInputElement).value || '';
    }
  }

  // This method will be used in the next section for updating input text
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private setInputText(text: string): void {
    if (!this.state.inputElement) return;

    if (this.state.inputElement.tagName === 'TEXTAREA') {
      (this.state.inputElement as HTMLTextAreaElement).value = text;
    } else if (this.state.inputElement.contentEditable === 'true') {
      this.state.inputElement.textContent = text;
    } else {
      (this.state.inputElement as HTMLInputElement).value = text;
    }

    // Trigger input event to notify the app
    this.state.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private async preloadPIIModels(): Promise<void> {
    try {
      console.log('[PII Checker] Preloading PII detection models...');
      await piiWorkerClient.preloadModels();
      console.log('[PII Checker] PII models preloaded successfully');
    } catch (error) {
      console.warn('[PII Checker] Failed to preload PII models:', error);
    }
  }

  private showMaskingNotification(spanCount: number): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = `🛡️ Masked ${spanCount} PII item${spanCount > 1 ? 's' : ''}`;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }

  private disableSendButton(): void {
    if (!this.state.sendButton) return;

    this.state.sendButton.setAttribute('disabled', 'true');
    this.state.sendButton.setAttribute('aria-disabled', 'true');
    
    // Add visual indicator
    const originalStyle = this.state.sendButton.style.cssText;
    this.state.sendButton.dataset.originalStyle = originalStyle;
    this.state.sendButton.style.opacity = '0.5';
    this.state.sendButton.style.pointerEvents = 'none';
  }

  private enableSendButton(): void {
    if (!this.state.sendButton) return;

    this.state.sendButton.removeAttribute('disabled');
    this.state.sendButton.removeAttribute('aria-disabled');
    
    // Restore original styling
    if (this.state.sendButton.dataset.originalStyle !== undefined) {
      this.state.sendButton.style.cssText = this.state.sendButton.dataset.originalStyle;
      delete this.state.sendButton.dataset.originalStyle;
    }
  }

  private triggerOriginalSubmit(): void {
    if (!this.state.sendButton) return;

    // Temporarily remove our handler to avoid recursion
    this.cleanupHandlers();
    
    // Trigger the original click
    setTimeout(() => {
      if (this.state.sendButton) {
        this.state.sendButton.click();
      }
      // Re-attach handlers after a brief delay
      setTimeout(() => this.attachHandlers(), 100);
    }, 50);
  }

  private showError(message: string): void {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
    `;
    toast.textContent = message;
    
    toast.addEventListener('click', () => {
      document.body.removeChild(toast);
      this.triggerOriginalSubmit();
    });
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 5000);
  }

  public destroy(): void {
    this.cleanupHandlers();
    this.observer?.disconnect();
  }
}

// Initialize the interceptor
let interceptor: PIIInterceptor | null = null;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    interceptor = new PIIInterceptor();
  });
} else {
  interceptor = new PIIInterceptor();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (interceptor) {
    interceptor.destroy();
  }
});
