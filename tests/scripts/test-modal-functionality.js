/**
 * Simple Modal Functionality Test
 * This test verifies that the modal JavaScript is working correctly
 */

console.log('🔧 Testing Modal Functionality...\n');

// Test 1: Check if modal elements exist in HTML
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

console.log('✅ Test 1: HTML Structure');
const modalElements = [
  'id="addProductModal"',
  'id="modalProductForm"',
  'id="modalProductName"',
  'id="modalProductType"',
  'id="modalQuantity"',
  'id="modalPrice"',
  'id="modalDescription"',
  'id="modalProductImage"',
  'id="modalGenerateAI"',
  'id="addProductBtn"',
  'id="modalAiPreview"',
  'id="modalAiTitle"',
  'id="modalAiDescription"'
];

modalElements.forEach(element => {
  if (htmlContent.includes(element)) {
    console.log(`  ✓ ${element} exists`);
  } else {
    console.log(`  ✗ ${element} MISSING`);
  }
});

// Test 2: Check if JavaScript has modal functionality
console.log('\n✅ Test 2: JavaScript Functions');
const jsPath = path.join(__dirname, 'public/script.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');

const jsFunctions = [
  'addProductFromModal',
  'displayModalAIContent',
  'hideModalAIPreview',
  'clearModalForm',
  'showModalLoading',
  'handleModalImagePreview'
];

jsFunctions.forEach(func => {
  if (jsContent.includes(func)) {
    console.log(`  ✓ ${func}() exists`);
  } else {
    console.log(`  ✗ ${func}() MISSING`);
  }
});

// Test 3: Check event bindings
console.log('\n✅ Test 3: Event Bindings');
const eventBindings = [
  'getElementById(\'addProductBtn\').addEventListener',
  'getElementById(\'modalProductImage\').addEventListener',
  'getElementById(\'modalEditTitleBtn\').addEventListener',
  'getElementById(\'modalEditDescBtn\').addEventListener'
];

eventBindings.forEach(binding => {
  if (jsContent.includes(binding)) {
    console.log(`  ✓ ${binding} exists`);
  } else {
    console.log(`  ✗ ${binding} MISSING`);
  }
});

// Test 4: API endpoints check
console.log('\n✅ Test 4: API Endpoints');
const routesPath = path.join(__dirname, 'routes/products.js');
const routesContent = fs.readFileSync(routesPath, 'utf8');

if (routesContent.includes('router.post(\'/\'')) {
  console.log('  ✓ POST /api/products endpoint exists');
} else {
  console.log('  ✗ POST /api/products endpoint MISSING');
}

const imagesPath = path.join(__dirname, 'routes/images.js');
const imagesContent = fs.readFileSync(imagesPath, 'utf8');

if (imagesContent.includes('router.post(\'/upload/:productId\'')) {
  console.log('  ✓ POST /api/images/upload/:productId endpoint exists');
} else {
  console.log('  ✗ POST /api/images/upload/:productId endpoint MISSING');
}

console.log('\n🎯 Modal Functionality Analysis Complete!');
console.log('\nIf all elements exist but modal still doesn\'t work, the issue is likely:');
console.log('1. Event binding timing (DOM not ready when events are bound)');
console.log('2. JavaScript errors preventing event binding');
console.log('3. Bootstrap modal not properly initialized');
console.log('4. Network/API issues preventing successful requests');

// Test 5: Create a simple debugging script
const debugScript = `
// Debug Modal Functionality
console.log('🔍 Modal Debug Script Running...');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  
  // Check if elements exist
  const addProductBtn = document.getElementById('addProductBtn');
  const modalForm = document.getElementById('modalProductForm');
  const modal = document.getElementById('addProductModal');
  
  console.log('Add Product Button:', addProductBtn);
  console.log('Modal Form:', modalForm);
  console.log('Modal:', modal);
  
  // Check if InventoryManager exists
  console.log('InventoryManager available:', typeof window.inventoryManager);
  
  if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
      console.log('🎯 Modal button clicked!');
      
      // Get form values
      const name = document.getElementById('modalProductName').value;
      const type = document.getElementById('modalProductType').value;
      const quantity = document.getElementById('modalQuantity').value;
      const price = document.getElementById('modalPrice').value;
      
      console.log('Form values:', { name, type, quantity, price });
      
      if (window.inventoryManager && window.inventoryManager.addProductFromModal) {
        console.log('Calling addProductFromModal...');
        window.inventoryManager.addProductFromModal();
      } else {
        console.error('InventoryManager or addProductFromModal not available');
      }
    });
    
    console.log('✅ Event listener attached to modal button');
  } else {
    console.error('❌ Add Product Button not found');
  }
});
`;

fs.writeFileSync(path.join(__dirname, 'public/modal-debug.js'), debugScript);
console.log('\n📝 Created modal-debug.js for browser testing');
console.log('   Add <script src="modal-debug.js"></script> to index.html to debug in browser');

console.log('\n🚀 Next Steps:');
console.log('1. Check browser console for JavaScript errors');
console.log('2. Verify MongoDB connection is working');
console.log('3. Test API endpoints directly with curl or Postman');
console.log('4. Use the debug script to trace modal button clicks');
