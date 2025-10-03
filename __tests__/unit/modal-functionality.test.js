/**
 * Unit Tests for Modal Product Addition Functionality
 * Tests the frontend JavaScript functionality with mocked backend calls
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock bootstrap modal
global.bootstrap = {
  Modal: {
    getInstance: jest.fn(() => ({
      hide: jest.fn()
    }))
  }
};

describe('Modal Product Addition Tests', () => {
  let dom;
  let window;
  let document;
  let inventoryManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    fetch.mockClear();

    // Create DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Main form elements -->
          <form id="productForm">
            <input type="text" id="productName" />
            <select id="productType">
              <option value="bed-covers">Bed Covers</option>
            </select>
            <input type="number" id="quantity" />
            <input type="number" id="price" />
            <textarea id="description"></textarea>
            <input type="file" id="productImage" />
            <input type="checkbox" id="generateAI" checked />
            <button type="submit">Add Product</button>
          </form>

          <!-- Modal form elements -->
          <form id="modalProductForm">
            <input type="text" id="modalProductName" />
            <select id="modalProductType">
              <option value="bed-covers">Bed Covers</option>
            </select>
            <input type="number" id="modalQuantity" />
            <input type="number" id="modalPrice" />
            <textarea id="modalDescription"></textarea>
            <input type="file" id="modalProductImage" />
            <input type="checkbox" id="modalGenerateAI" checked />
          </form>
          
          <button id="addProductBtn">Add Product</button>
          <button id="saveEditBtn">Save Edit</button>
          
          <!-- Search and filter -->
          <input type="text" id="searchInput" />
          <select id="filterType"></select>
          
          <!-- Product table -->
          <table>
            <tbody id="productTableBody"></tbody>
          </table>
          
          <!-- Summary elements -->
          <span id="totalProducts">0</span>
          <span id="totalValue">$0.00</span>
          <div id="typeBreakdown"></div>
          
          <!-- Analytics elements -->
          <div id="analyticsContainer">
            <div class="row" style="display: none;"></div>
          </div>
          <div id="emptyAnalyticsState" style="display: block;"></div>
          <canvas id="pieChart"></canvas>
          <canvas id="barChart"></canvas>
          
          <!-- AI Preview elements -->
          <div id="aiPreview" style="display: none;">
            <input type="text" id="aiTitle" readonly />
            <textarea id="aiDescription" readonly></textarea>
            <span id="aiConfidence">--</span>
            <span id="aiModel">--</span>
            <button id="editTitleBtn">Edit</button>
            <button id="editDescBtn">Edit</button>
          </div>
          
          <!-- Modal AI Preview elements -->
          <div id="modalAiPreview" style="display: none;">
            <input type="text" id="modalAiTitle" readonly />
            <textarea id="modalAiDescription" readonly></textarea>
            <span id="modalAiConfidence">--</span>
            <span id="modalAiModel">--</span>
            <button id="modalEditTitleBtn">Edit</button>
            <button id="modalEditDescBtn">Edit</button>
          </div>

          <!-- Edit modal -->
          <div id="editProductModal">
            <input type="hidden" id="editProductId" />
            <input type="text" id="editProductName" />
            <select id="editProductType"></select>
            <input type="number" id="editQuantity" />
            <input type="number" id="editPrice" />
            <textarea id="editDescription"></textarea>
          </div>

          <!-- Add Product Modal -->
          <div id="addProductModal"></div>
          
          <!-- Container for alerts -->
          <div class="container">
            <div class="row"></div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    
    // Set global objects
    global.window = window;
    global.document = document;
    global.navigator = {
      onLine: true,
      serviceWorker: {
        addEventListener: jest.fn(),
        getRegistration: jest.fn()
      }
    };

    // Mock IndexedDBManager
    global.IndexedDBManager = class {
      async init() { return true; }
      async getAllProducts() { return []; }
      async saveProduct() { return true; }
    };

    // Load the InventoryManager class
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../../public/script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Execute the script in our mock environment
    eval(scriptContent);
    
    // Create inventory manager instance
    inventoryManager = new window.InventoryManager();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Modal Form Validation', () => {
    test('should validate required fields in modal', async () => {
      // Set up form with missing required fields
      document.getElementById('modalProductName').value = '';
      document.getElementById('modalProductType').value = 'bed-covers';
      document.getElementById('modalQuantity').value = '10';
      document.getElementById('modalPrice').value = '25.99';

      // Mock showAlert method
      inventoryManager.showAlert = jest.fn();

      // Try to add product
      await inventoryManager.addProductFromModal();

      // Should show validation error
      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Please fill in all required fields with valid values.',
        'danger'
      );
    });

    test('should validate negative quantities and prices', async () => {
      document.getElementById('modalProductName').value = 'Test Product';
      document.getElementById('modalProductType').value = 'bed-covers';
      document.getElementById('modalQuantity').value = '-5';
      document.getElementById('modalPrice').value = '25.99';

      inventoryManager.showAlert = jest.fn();

      await inventoryManager.addProductFromModal();

      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Please fill in all required fields with valid values.',
        'danger'
      );
    });
  });

  describe('Modal Product Creation', () => {
    beforeEach(() => {
      // Set up valid form data
      document.getElementById('modalProductName').value = 'Test Bed Cover';
      document.getElementById('modalProductType').value = 'bed-covers';
      document.getElementById('modalQuantity').value = '10';
      document.getElementById('modalPrice').value = '25.99';
      document.getElementById('modalDescription').value = 'A beautiful bed cover';
    });

    test('should create product successfully via modal', async () => {
      // Mock successful API response
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            _id: 'test-product-id',
            name: 'Test Bed Cover',
            type: 'bed-covers',
            quantity: 10,
            price: 25.99,
            description: 'A beautiful bed cover'
          }
        })
      });

      // Mock methods
      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();
      inventoryManager.loadProducts = jest.fn();
      inventoryManager.renderProducts = jest.fn();
      inventoryManager.updateSummary = jest.fn();
      inventoryManager.clearModalForm = jest.fn();
      inventoryManager.hideModalAIPreview = jest.fn();

      await inventoryManager.addProductFromModal();

      // Verify API was called correctly
      expect(fetch).toHaveBeenCalledWith('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Bed Cover',
          type: 'bed-covers',
          quantity: 10,
          price: 25.99,
          description: 'A beautiful bed cover'
        })
      });

      // Verify success actions
      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Product "Test Bed Cover" added successfully!',
        'success'
      );
      expect(inventoryManager.loadProducts).toHaveBeenCalled();
      expect(inventoryManager.renderProducts).toHaveBeenCalled();
      expect(inventoryManager.updateSummary).toHaveBeenCalled();
      expect(inventoryManager.clearModalForm).toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          message: 'Database connection failed'
        })
      });

      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();

      await inventoryManager.addProductFromModal();

      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Error adding product: Database connection failed',
        'danger'
      );
    });

    test('should handle network errors', async () => {
      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network error'));

      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();

      await inventoryManager.addProductFromModal();

      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Error adding product: Network error',
        'danger'
      );
    });
  });

  describe('Modal Image Upload and AI Generation', () => {
    beforeEach(() => {
      // Set up valid form data
      document.getElementById('modalProductName').value = 'Test Product';
      document.getElementById('modalProductType').value = 'bed-covers';
      document.getElementById('modalQuantity').value = '5';
      document.getElementById('modalPrice').value = '19.99';
      
      // Mock file
      const mockFile = new window.File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(document.getElementById('modalProductImage'), 'files', {
        value: [mockFile],
        writable: false
      });
    });

    test('should upload image and generate AI content', async () => {
      // Mock product creation response
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { _id: 'test-product-id' }
        })
      });

      // Mock image upload response with AI content
      inventoryManager.uploadProductImage = jest.fn().mockResolvedValue({
        success: true,
        aiGenerated: {
          title: 'AI Generated Title',
          description: 'AI Generated Description',
          confidence: 0.95,
          model: 'test-model'
        }
      });

      inventoryManager.displayModalAIContent = jest.fn();
      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();
      inventoryManager.loadProducts = jest.fn();
      inventoryManager.renderProducts = jest.fn();
      inventoryManager.updateSummary = jest.fn();
      inventoryManager.clearModalForm = jest.fn();
      inventoryManager.hideModalAIPreview = jest.fn();

      await inventoryManager.addProductFromModal();

      // Verify image upload was called
      expect(inventoryManager.uploadProductImage).toHaveBeenCalledWith(
        'test-product-id',
        expect.any(window.File),
        true
      );

      // Verify AI content was displayed
      expect(inventoryManager.displayModalAIContent).toHaveBeenCalledWith({
        title: 'AI Generated Title',
        description: 'AI Generated Description',
        confidence: 0.95,
        model: 'test-model'
      });
    });

    test('should handle image upload failure gracefully', async () => {
      // Mock product creation success but image upload failure
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { _id: 'test-product-id' }
        })
      });

      inventoryManager.uploadProductImage = jest.fn().mockResolvedValue(null);
      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();
      inventoryManager.loadProducts = jest.fn();
      inventoryManager.renderProducts = jest.fn();
      inventoryManager.updateSummary = jest.fn();
      inventoryManager.clearModalForm = jest.fn();
      inventoryManager.hideModalAIPreview = jest.fn();

      await inventoryManager.addProductFromModal();

      // Should still complete successfully even if image upload fails
      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Product "Test Product" added successfully!',
        'success'
      );
    });
  });

  describe('Modal Offline Functionality', () => {
    beforeEach(() => {
      // Set offline mode
      inventoryManager.isOnline = false;
      
      // Set up form data
      document.getElementById('modalProductName').value = 'Offline Product';
      document.getElementById('modalProductType').value = 'towels';
      document.getElementById('modalQuantity').value = '3';
      document.getElementById('modalPrice').value = '12.50';
    });

    test('should create optimistic product when offline', async () => {
      inventoryManager.products = [];
      inventoryManager.showAlert = jest.fn();
      inventoryManager.showModalLoading = jest.fn();
      inventoryManager.saveToCache = jest.fn();
      inventoryManager.renderProducts = jest.fn();
      inventoryManager.updateSummary = jest.fn();
      inventoryManager.clearModalForm = jest.fn();

      await inventoryManager.addProductFromModal();

      // Verify optimistic product was created
      expect(inventoryManager.products).toHaveLength(1);
      expect(inventoryManager.products[0]).toEqual(
        expect.objectContaining({
          name: 'Offline Product',
          type: 'towels',
          quantity: 3,
          price: 12.50,
          _isOptimistic: true,
          _isPending: true
        })
      );

      expect(inventoryManager.showAlert).toHaveBeenCalledWith(
        'Product "Offline Product" added locally. Will sync when online.',
        'info'
      );
    });
  });

  describe('Modal Helper Functions', () => {
    test('should display modal AI content correctly', () => {
      const aiData = {
        title: 'Generated Title',
        description: 'Generated Description',
        confidence: 0.87,
        model: 'llava-model'
      };

      inventoryManager.displayModalAIContent(aiData);

      expect(document.getElementById('modalAiTitle').value).toBe('Generated Title');
      expect(document.getElementById('modalAiDescription').value).toBe('Generated Description');
      expect(document.getElementById('modalAiConfidence').textContent).toBe('87');
      expect(document.getElementById('modalAiModel').textContent).toBe('llava-model');
      expect(document.getElementById('modalAiPreview').style.display).toBe('block');
    });

    test('should hide modal AI preview', () => {
      // First show the preview
      document.getElementById('modalAiPreview').style.display = 'block';
      document.getElementById('modalAiTitle').value = 'test';
      document.getElementById('modalAiDescription').value = 'test';

      inventoryManager.hideModalAIPreview();

      expect(document.getElementById('modalAiPreview').style.display).toBe('none');
      expect(document.getElementById('modalAiTitle').value).toBe('');
      expect(document.getElementById('modalAiDescription').value).toBe('');
    });

    test('should clear modal form', () => {
      // Set form values
      document.getElementById('modalProductName').value = 'test';
      document.getElementById('modalProductType').value = 'bed-covers';
      document.getElementById('modalQuantity').value = '5';

      // Mock the reset method
      document.getElementById('modalProductForm').reset = jest.fn();
      inventoryManager.hideModalAIPreview = jest.fn();

      inventoryManager.clearModalForm();

      expect(document.getElementById('modalProductForm').reset).toHaveBeenCalled();
      expect(inventoryManager.hideModalAIPreview).toHaveBeenCalled();
    });

    test('should show and hide modal loading state', () => {
      const addProductBtn = document.getElementById('addProductBtn');

      // Test show loading
      inventoryManager.showModalLoading(true);
      expect(addProductBtn.disabled).toBe(true);
      expect(addProductBtn.innerHTML).toContain('Loading...');

      // Test hide loading
      inventoryManager.showModalLoading(false);
      expect(addProductBtn.disabled).toBe(false);
      expect(addProductBtn.innerHTML).toContain('Add Product');
    });
  });

  describe('Event Binding', () => {
    test('should bind modal events correctly', () => {
      // Mock addEventListener
      const mockAddEventListener = jest.fn();
      document.getElementById('addProductBtn').addEventListener = mockAddEventListener;
      document.getElementById('modalProductImage').addEventListener = mockAddEventListener;
      document.getElementById('modalEditTitleBtn').addEventListener = mockAddEventListener;
      document.getElementById('modalEditDescBtn').addEventListener = mockAddEventListener;

      // Re-bind events
      inventoryManager.bindEvents();

      // Verify modal events were bound
      expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});
