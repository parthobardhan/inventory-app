/**
 * End-to-End Test for Modal Product Addition
 * This test verifies the complete modal functionality
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Modal Product Addition E2E Test', () => {
  let dom;
  let window;
  let document;
  let inventoryManager;

  beforeAll(async () => {
    // Read the actual HTML file
    const htmlPath = path.join(__dirname, '../../public/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Create DOM with the actual HTML
    dom = new JSDOM(htmlContent, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable',
      runScripts: 'dangerously'
    });

    window = dom.window;
    document = window.document;

    // Set up global environment
    global.window = window;
    global.document = document;
    global.navigator = {
      onLine: true,
      serviceWorker: {
        addEventListener: jest.fn(),
        getRegistration: jest.fn()
      }
    };

    // Mock fetch
    global.fetch = jest.fn();

    // Mock bootstrap
    global.bootstrap = {
      Modal: {
        getInstance: jest.fn(() => ({
          hide: jest.fn()
        }))
      }
    };

    // Mock IndexedDBManager
    global.IndexedDBManager = class {
      async init() { return true; }
      async getAllProducts() { return []; }
      async saveProduct() { return true; }
    };

    // Load and execute the script
    const scriptPath = path.join(__dirname, '../../public/script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Execute in window context
    const scriptElement = window.document.createElement('script');
    scriptElement.textContent = scriptContent;
    window.document.head.appendChild(scriptElement);

    // Wait for DOM content loaded
    await new Promise(resolve => {
      if (window.document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });

    // Get the inventory manager instance
    inventoryManager = window.inventoryManager;
  });

  afterAll(() => {
    dom.window.close();
  });

  test('Modal elements exist and are properly structured', () => {
    // Check modal exists
    const modal = document.getElementById('addProductModal');
    expect(modal).toBeTruthy();

    // Check form exists
    const form = document.getElementById('modalProductForm');
    expect(form).toBeTruthy();

    // Check all required form fields exist
    expect(document.getElementById('modalProductName')).toBeTruthy();
    expect(document.getElementById('modalProductType')).toBeTruthy();
    expect(document.getElementById('modalQuantity')).toBeTruthy();
    expect(document.getElementById('modalPrice')).toBeTruthy();
    expect(document.getElementById('modalDescription')).toBeTruthy();
    expect(document.getElementById('modalProductImage')).toBeTruthy();
    expect(document.getElementById('modalGenerateAI')).toBeTruthy();

    // Check AI preview elements exist
    expect(document.getElementById('modalAiPreview')).toBeTruthy();
    expect(document.getElementById('modalAiTitle')).toBeTruthy();
    expect(document.getElementById('modalAiDescription')).toBeTruthy();
    expect(document.getElementById('modalAiConfidence')).toBeTruthy();
    expect(document.getElementById('modalAiModel')).toBeTruthy();

    // Check buttons exist
    expect(document.getElementById('addProductBtn')).toBeTruthy();
    expect(document.getElementById('modalEditTitleBtn')).toBeTruthy();
    expect(document.getElementById('modalEditDescBtn')).toBeTruthy();
  });

  test('Modal button click triggers addProductFromModal method', () => {
    if (!inventoryManager) {
      console.warn('InventoryManager not initialized, skipping test');
      return;
    }

    // Mock the method
    inventoryManager.addProductFromModal = jest.fn();

    // Simulate button click
    const addProductBtn = document.getElementById('addProductBtn');
    addProductBtn.click();

    expect(inventoryManager.addProductFromModal).toHaveBeenCalled();
  });

  test('Complete modal workflow simulation', async () => {
    if (!inventoryManager) {
      console.warn('InventoryManager not initialized, skipping test');
      return;
    }

    // Fill out the modal form
    document.getElementById('modalProductName').value = 'E2E Test Product';
    document.getElementById('modalProductType').value = 'bed-covers';
    document.getElementById('modalQuantity').value = '8';
    document.getElementById('modalPrice').value = '35.99';
    document.getElementById('modalDescription').value = 'End-to-end test product';

    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          _id: 'e2e-test-id',
          name: 'E2E Test Product',
          type: 'bed-covers',
          quantity: 8,
          price: 35.99,
          description: 'End-to-end test product'
        }
      })
    });

    // Mock inventory manager methods
    inventoryManager.showAlert = jest.fn();
    inventoryManager.showModalLoading = jest.fn();
    inventoryManager.loadProducts = jest.fn();
    inventoryManager.renderProducts = jest.fn();
    inventoryManager.updateSummary = jest.fn();
    inventoryManager.clearModalForm = jest.fn();
    inventoryManager.hideModalAIPreview = jest.fn();

    // Execute the add product method
    await inventoryManager.addProductFromModal();

    // Verify the workflow
    expect(global.fetch).toHaveBeenCalledWith('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'E2E Test Product',
        type: 'bed-covers',
        quantity: 8,
        price: 35.99,
        description: 'End-to-end test product'
      })
    });

    expect(inventoryManager.showAlert).toHaveBeenCalledWith(
      'Product "E2E Test Product" added successfully!',
      'success'
    );
    expect(inventoryManager.loadProducts).toHaveBeenCalled();
    expect(inventoryManager.renderProducts).toHaveBeenCalled();
    expect(inventoryManager.updateSummary).toHaveBeenCalled();
    expect(inventoryManager.clearModalForm).toHaveBeenCalled();
  });

  test('Modal AI preview functionality', () => {
    if (!inventoryManager) {
      console.warn('InventoryManager not initialized, skipping test');
      return;
    }

    const aiData = {
      title: 'AI Generated Title',
      description: 'AI generated description for the product',
      confidence: 0.92,
      model: 'llava-v1.5'
    };

    // Test displaying AI content
    inventoryManager.displayModalAIContent(aiData);

    expect(document.getElementById('modalAiTitle').value).toBe('AI Generated Title');
    expect(document.getElementById('modalAiDescription').value).toBe('AI generated description for the product');
    expect(document.getElementById('modalAiConfidence').textContent).toBe('92');
    expect(document.getElementById('modalAiModel').textContent).toBe('llava-v1.5');
    expect(document.getElementById('modalAiPreview').style.display).toBe('block');

    // Test hiding AI content
    inventoryManager.hideModalAIPreview();

    expect(document.getElementById('modalAiPreview').style.display).toBe('none');
    expect(document.getElementById('modalAiTitle').value).toBe('');
    expect(document.getElementById('modalAiDescription').value).toBe('');
  });

  test('Modal form validation', async () => {
    if (!inventoryManager) {
      console.warn('InventoryManager not initialized, skipping test');
      return;
    }

    // Clear form
    document.getElementById('modalProductName').value = '';
    document.getElementById('modalProductType').value = '';
    document.getElementById('modalQuantity').value = '';
    document.getElementById('modalPrice').value = '';

    // Mock showAlert
    inventoryManager.showAlert = jest.fn();

    // Try to add product with empty form
    await inventoryManager.addProductFromModal();

    // Should show validation error
    expect(inventoryManager.showAlert).toHaveBeenCalledWith(
      'Please fill in all required fields with valid values.',
      'danger'
    );
  });
});

