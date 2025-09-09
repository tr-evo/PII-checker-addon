import { piiLogger } from './logger';

/**
 * Tracks file uploads on web pages
 */
export class UploadTracker {
  private isTracking = false;
  private trackedElements = new WeakSet<Element>();

  /**
   * Start tracking file uploads
   */
  startTracking(): void {
    if (this.isTracking) return;

    console.log('[Upload Tracker] Starting file upload tracking');
    
    this.setupFileInputListeners();
    this.setupDragDropListeners();
    this.observeDOMChanges();
    
    this.isTracking = true;
  }

  /**
   * Stop tracking file uploads
   */
  stopTracking(): void {
    if (!this.isTracking) return;

    console.log('[Upload Tracker] Stopping file upload tracking');
    this.isTracking = false;
  }

  /**
   * Set up listeners for file input elements
   */
  private setupFileInputListeners(): void {
    // Find existing file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => this.attachFileInputListener(input as HTMLInputElement));

    // Listen for dynamically added file inputs
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the element itself is a file input
            if (element.tagName === 'INPUT' && element.getAttribute('type') === 'file') {
              this.attachFileInputListener(element as HTMLInputElement);
            }
            
            // Check for file inputs within the added element
            const fileInputs = element.querySelectorAll('input[type="file"]');
            fileInputs.forEach(input => this.attachFileInputListener(input as HTMLInputElement));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Attach change listener to a file input
   */
  private attachFileInputListener(input: HTMLInputElement): void {
    if (this.trackedElements.has(input)) return;

    this.trackedElements.add(input);

    input.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        console.log(`[Upload Tracker] File input changed: ${files.length} file(s)`);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await this.logFileUpload(file);
        }
      }
    });

    console.log('[Upload Tracker] Attached listener to file input');
  }

  /**
   * Set up drag and drop listeners
   */
  private setupDragDropListeners(): void {
    // Find potential drop zones
    const dropZones = this.findDropZones();
    dropZones.forEach(zone => this.attachDropListener(zone));
  }

  /**
   * Find potential drop zones in the DOM
   */
  private findDropZones(): Element[] {
    const dropZones: Element[] = [];

    // Look for elements with drag/drop event listeners or relevant attributes
    const selectors = [
      '[draggable]',
      '[ondrop]',
      '[ondragover]',
      '[ondragenter]',
      '.drop-zone',
      '.dropzone',
      '.file-drop',
      '.upload-area',
      '[data-drop]',
      '[data-upload]'
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        dropZones.push(...Array.from(elements));
      } catch (error) {
        // Ignore invalid selectors
      }
    });

    // Also check common areas that might accept drops
    const commonAreas = document.querySelectorAll('main, .chat, .conversation, .input-area, form');
    dropZones.push(...Array.from(commonAreas));

    return dropZones;
  }

  /**
   * Attach drop listener to an element
   */
  private attachDropListener(element: Element): void {
    if (this.trackedElements.has(element)) return;

    this.trackedElements.add(element);

    element.addEventListener('drop', async (event) => {
      const dropEvent = event as DragEvent;
      
      if (dropEvent.dataTransfer && dropEvent.dataTransfer.files.length > 0) {
        console.log(`[Upload Tracker] Files dropped: ${dropEvent.dataTransfer.files.length} file(s)`);
        
        const files = Array.from(dropEvent.dataTransfer.files);
        for (const file of files) {
          await this.logFileUpload(file);
        }
      }
    });

    // Prevent default drag behavior to allow drops
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    element.addEventListener('dragenter', (event) => {
      event.preventDefault();
    });

    console.log('[Upload Tracker] Attached drop listener to element:', element.tagName);
  }

  /**
   * Observe DOM changes for new drop zones
   */
  private observeDOMChanges(): void {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the element might be a drop zone
            if (this.mightBeDropZone(element)) {
              this.attachDropListener(element);
            }
            
            // Check for drop zones within the added element
            const dropZones = this.findDropZonesIn(element);
            dropZones.forEach(zone => this.attachDropListener(zone));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if an element might be a drop zone
   */
  private mightBeDropZone(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();

    // Check for common drop zone indicators
    return (
      tagName === 'form' ||
      className.includes('drop') ||
      className.includes('upload') ||
      className.includes('file') ||
      className.includes('chat') ||
      className.includes('input') ||
      id.includes('drop') ||
      id.includes('upload') ||
      element.hasAttribute('draggable') ||
      element.hasAttribute('ondrop')
    );
  }

  /**
   * Find drop zones within an element
   */
  private findDropZonesIn(element: Element): Element[] {
    const dropZones: Element[] = [];
    
    const selectors = [
      'input[type="file"]',
      '[draggable]',
      '[ondrop]',
      '.drop-zone',
      '.upload-area'
    ];

    selectors.forEach(selector => {
      try {
        const found = element.querySelectorAll(selector);
        dropZones.push(...Array.from(found));
      } catch (error) {
        // Ignore invalid selectors
      }
    });

    return dropZones;
  }

  /**
   * Log a file upload
   */
  private async logFileUpload(file: File): Promise<void> {
    try {
      const site = window.location.hostname;
      
      await piiLogger.logUpload({
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        site
      });

      console.log(`[Upload Tracker] Logged file upload: ${file.name} (${this.formatFileSize(file.size)})`);
    } catch (error) {
      console.warn('[Upload Tracker] Failed to log file upload:', error);
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
export const uploadTracker = new UploadTracker();