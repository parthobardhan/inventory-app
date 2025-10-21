// Cost Breakdown Diagnostic Script
// Copy and paste this into the browser console to diagnose issues

(function() {
    console.log('🔍 Starting Cost Breakdown Diagnostics...\n');
    
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };
    
    // Test 1: Check if CostBreakdownManager exists
    console.log('Test 1: Checking CostBreakdownManager...');
    if (window.costBreakdownManager) {
        results.passed.push('✅ CostBreakdownManager is initialized');
        console.log('✅ PASS: CostBreakdownManager found');
    } else {
        results.failed.push('❌ CostBreakdownManager not found');
        console.error('❌ FAIL: CostBreakdownManager not initialized');
    }
    
    // Test 2: Check if InventoryManager exists
    console.log('\nTest 2: Checking InventoryManager...');
    if (window.inventoryManager) {
        results.passed.push('✅ InventoryManager is initialized');
        console.log('✅ PASS: InventoryManager found');
    } else {
        results.failed.push('❌ InventoryManager not found');
        console.error('❌ FAIL: InventoryManager not initialized');
    }
    
    // Test 3: Check if Add Cost Item button exists
    console.log('\nTest 3: Checking Add Cost Item button...');
    const addBtn = document.getElementById('modalAddCostItemBtn');
    if (addBtn) {
        results.passed.push('✅ Add Cost Item button exists');
        console.log('✅ PASS: Button found', addBtn);
    } else {
        results.failed.push('❌ Add Cost Item button not found');
        console.error('❌ FAIL: modalAddCostItemBtn not in DOM');
    }
    
    // Test 4: Check if additional costs container exists
    console.log('\nTest 4: Checking additional costs container...');
    const container = document.getElementById('modalAdditionalCosts');
    if (container) {
        results.passed.push('✅ Additional costs container exists');
        console.log('✅ PASS: Container found', container);
    } else {
        results.failed.push('❌ Additional costs container not found');
        console.error('❌ FAIL: modalAdditionalCosts not in DOM');
    }
    
    // Test 5: Check if total cost input exists
    console.log('\nTest 5: Checking total cost input...');
    const totalInput = document.getElementById('modalTotalCost');
    if (totalInput) {
        results.passed.push('✅ Total cost input exists');
        console.log('✅ PASS: Total input found', totalInput);
        console.log('   Current value:', totalInput.value || '(empty)');
    } else {
        results.failed.push('❌ Total cost input not found');
        console.error('❌ FAIL: modalTotalCost not in DOM');
    }
    
    // Test 6: Check if modal exists
    console.log('\nTest 6: Checking product modal...');
    const modal = document.getElementById('addProductModal');
    if (modal) {
        results.passed.push('✅ Add Product modal exists');
        console.log('✅ PASS: Modal found', modal);
    } else {
        results.failed.push('❌ Add Product modal not found');
        console.error('❌ FAIL: addProductModal not in DOM');
    }
    
    // Test 7: Check for cost breakdown input fields
    console.log('\nTest 7: Checking cost breakdown input fields...');
    const materialInput = document.getElementById('modalCostMaterial');
    const embroideryInput = document.getElementById('modalCostEmbroidery');
    if (materialInput && embroideryInput) {
        results.passed.push('✅ Material and Embroidery inputs exist');
        console.log('✅ PASS: Fixed cost inputs found');
        console.log('   Material value:', materialInput.value || '0');
        console.log('   Embroidery value:', embroideryInput.value || '0');
    } else {
        results.failed.push('❌ Material or Embroidery inputs not found');
        console.error('❌ FAIL: Fixed cost inputs missing');
    }
    
    // Test 8: Check all cost breakdown items
    console.log('\nTest 8: Checking all cost breakdown items...');
    const allCostItems = document.querySelectorAll('.cost-breakdown-item');
    if (allCostItems.length > 0) {
        results.passed.push(`✅ Found ${allCostItems.length} cost breakdown items`);
        console.log(`✅ PASS: ${allCostItems.length} cost items found`);
        allCostItems.forEach((item, index) => {
            console.log(`   Item ${index + 1}:`, item.value || '0', item);
        });
    } else {
        results.warnings.push('⚠️ No cost breakdown items found (might be expected if modal not opened)');
        console.warn('⚠️ WARNING: No cost items found');
    }
    
    // Test 9: Try to calculate total
    console.log('\nTest 9: Testing total cost calculation...');
    try {
        if (window.costBreakdownManager && typeof window.costBreakdownManager.updateTotalCost === 'function') {
            const total = window.costBreakdownManager.updateTotalCost();
            results.passed.push(`✅ Total cost calculation works: $${total.toFixed(2)}`);
            console.log('✅ PASS: Calculated total:', total);
        } else {
            results.failed.push('❌ updateTotalCost function not available');
            console.error('❌ FAIL: updateTotalCost method not found');
        }
    } catch (error) {
        results.failed.push(`❌ Error calculating total: ${error.message}`);
        console.error('❌ FAIL: Error in updateTotalCost:', error);
    }
    
    // Test 10: Try to add a cost item
    console.log('\nTest 10: Testing add cost item functionality...');
    try {
        if (window.costBreakdownManager && typeof window.costBreakdownManager.addCostItem === 'function') {
            // Don't actually add, just check if function is callable
            if (container) {
                const beforeCount = container.children.length;
                window.costBreakdownManager.addCostItem('Test Item', 10);
                const afterCount = container.children.length;
                if (afterCount > beforeCount) {
                    results.passed.push('✅ addCostItem function works');
                    console.log('✅ PASS: Cost item added successfully');
                    // Clean up
                    window.costBreakdownManager.removeCostItem(`costItem${window.costBreakdownManager.costItemCounter}`);
                } else {
                    results.failed.push('❌ addCostItem did not add item');
                    console.error('❌ FAIL: Item count did not increase');
                }
            } else {
                results.warnings.push('⚠️ Cannot test addCostItem without container');
                console.warn('⚠️ WARNING: Container not available for test');
            }
        } else {
            results.failed.push('❌ addCostItem function not available');
            console.error('❌ FAIL: addCostItem method not found');
        }
    } catch (error) {
        results.failed.push(`❌ Error adding cost item: ${error.message}`);
        console.error('❌ FAIL: Error in addCostItem:', error);
    }
    
    // Test 11: Check Service Worker status
    console.log('\nTest 11: Checking Service Worker...');
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration) {
                results.passed.push('✅ Service Worker registered');
                console.log('✅ PASS: Service Worker active');
                if (registration.waiting) {
                    results.warnings.push('⚠️ Service Worker update waiting');
                    console.warn('⚠️ WARNING: New SW version waiting. Refresh to activate.');
                }
            } else {
                results.warnings.push('⚠️ No Service Worker registration');
                console.warn('⚠️ WARNING: Service Worker not registered');
            }
        });
    } else {
        results.warnings.push('⚠️ Service Worker not supported');
        console.warn('⚠️ WARNING: Service Worker not supported in this browser');
    }
    
    // Test 12: Check cache status
    console.log('\nTest 12: Checking cache status...');
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            console.log('📦 Cache names:', cacheNames);
            if (cacheNames.includes('textile-inventory-v1.0.1')) {
                results.passed.push('✅ Latest cache version (v1.0.1)');
                console.log('✅ PASS: Using latest cache');
            } else if (cacheNames.some(name => name.startsWith('textile-inventory'))) {
                results.warnings.push('⚠️ Old cache version detected');
                console.warn('⚠️ WARNING: Old cache version. Hard refresh recommended.');
                console.warn('   Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)');
            } else {
                results.warnings.push('⚠️ No app cache found');
                console.warn('⚠️ WARNING: No cache found');
            }
        });
    }
    
    // Print Summary
    setTimeout(() => {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DIAGNOSTIC SUMMARY');
        console.log('='.repeat(60));
        
        console.log('\n✅ PASSED TESTS (' + results.passed.length + '):');
        results.passed.forEach(msg => console.log('  ' + msg));
        
        if (results.warnings.length > 0) {
            console.log('\n⚠️ WARNINGS (' + results.warnings.length + '):');
            results.warnings.forEach(msg => console.warn('  ' + msg));
        }
        
        if (results.failed.length > 0) {
            console.log('\n❌ FAILED TESTS (' + results.failed.length + '):');
            results.failed.forEach(msg => console.error('  ' + msg));
        }
        
        console.log('\n' + '='.repeat(60));
        
        if (results.failed.length === 0) {
            console.log('🎉 ALL CRITICAL TESTS PASSED!');
            console.log('Cost Breakdown should be working correctly.');
        } else {
            console.log('⚠️ SOME TESTS FAILED');
            console.log('Please review the failures above.');
            
            if (results.failed.some(msg => msg.includes('CostBreakdownManager'))) {
                console.log('\n💡 SUGGESTION: CostBreakdownManager not loading.');
                console.log('   1. Check if js/utils/CostBreakdownManager.js exists');
                console.log('   2. Check browser console for loading errors');
                console.log('   3. Hard refresh: Ctrl+Shift+R (Win/Linux) or Cmd+Shift+R (Mac)');
            }
            
            if (results.failed.some(msg => msg.includes('button')) || results.failed.some(msg => msg.includes('container'))) {
                console.log('\n💡 SUGGESTION: Modal elements not found.');
                console.log('   1. Try opening the Add Product modal first');
                console.log('   2. Then run this diagnostic again');
            }
        }
        
        console.log('='.repeat(60) + '\n');
        
        // Return results object for programmatic access
        return {
            passed: results.passed.length,
            warnings: results.warnings.length,
            failed: results.failed.length,
            details: results
        };
    }, 1000);
    
    console.log('\n⏳ Running async tests...\n');
})();

