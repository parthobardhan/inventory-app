#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that the modal functionality works correctly
 * after deployment to Vercel or any other hosting platform.
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
    // Add your deployed URL here
    deployedUrl: process.env.DEPLOYED_URL || 'http://localhost:3000',
    timeout: 10000,
    retries: 3
};

/**
 * Make HTTP request with timeout and retry logic
 */
function makeRequest(url, retries = CONFIG.retries) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', (err) => {
            if (retries > 0) {
                console.log(`❌ Request failed, retrying... (${retries} attempts left)`);
                setTimeout(() => {
                    makeRequest(url, retries - 1).then(resolve).catch(reject);
                }, 1000);
            } else {
                reject(err);
            }
        });
        
        req.setTimeout(CONFIG.timeout, () => {
            req.destroy();
            if (retries > 0) {
                console.log(`❌ Request timeout, retrying... (${retries} attempts left)`);
                setTimeout(() => {
                    makeRequest(url, retries - 1).then(resolve).catch(reject);
                }, 1000);
            } else {
                reject(new Error('Request timeout'));
            }
        });
    });
}

/**
 * Test if the main page loads correctly
 */
async function testMainPage() {
    console.log('🔍 Testing main page...');
    try {
        const response = await makeRequest(CONFIG.deployedUrl);
        
        if (response.statusCode === 200) {
            // Check for key elements in the HTML
            const hasModal = response.body.includes('addProductModal');
            const hasScript = response.body.includes('script.js');
            const hasBootstrap = response.body.includes('bootstrap');
            
            if (hasModal && hasScript && hasBootstrap) {
                console.log('✅ Main page loads correctly with all required elements');
                return true;
            } else {
                console.log('❌ Main page missing required elements');
                console.log(`   Modal: ${hasModal}, Script: ${hasScript}, Bootstrap: ${hasBootstrap}`);
                return false;
            }
        } else {
            console.log(`❌ Main page returned status ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Main page test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test if the API health endpoint works
 */
async function testApiHealth() {
    console.log('🔍 Testing API health endpoint...');
    try {
        const response = await makeRequest(`${CONFIG.deployedUrl}/api/health`);
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            if (data.success && data.message) {
                console.log('✅ API health endpoint working correctly');
                return true;
            } else {
                console.log('❌ API health endpoint returned invalid response');
                return false;
            }
        } else {
            console.log(`❌ API health endpoint returned status ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ API health test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test if static assets are served correctly
 */
async function testStaticAssets() {
    console.log('🔍 Testing static assets...');
    const assets = [
        '/script.js',
        '/styles.css',
        '/manifest.json'
    ];
    
    let allPassed = true;
    
    for (const asset of assets) {
        try {
            const response = await makeRequest(`${CONFIG.deployedUrl}${asset}`);
            if (response.statusCode === 200) {
                console.log(`✅ ${asset} served correctly`);
            } else {
                console.log(`❌ ${asset} returned status ${response.statusCode}`);
                allPassed = false;
            }
        } catch (error) {
            console.log(`❌ ${asset} failed: ${error.message}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

/**
 * Test modal functionality by checking for required elements
 */
async function testModalElements() {
    console.log('🔍 Testing modal elements...');
    try {
        const response = await makeRequest(CONFIG.deployedUrl);
        
        if (response.statusCode === 200) {
            const requiredElements = [
                'addProductModal',
                'modalProductForm',
                'modalProductName',
                'modalProductType',
                'modalQuantity',
                'modalPrice',
                'modalDescription',
                'addProductBtn',
                'modalProductNameError',
                'modalProductTypeError',
                'modalQuantityError',
                'modalPriceError'
            ];
            
            let allFound = true;
            const missing = [];
            
            requiredElements.forEach(element => {
                if (!response.body.includes(element)) {
                    missing.push(element);
                    allFound = false;
                }
            });
            
            if (allFound) {
                console.log('✅ All modal elements present in HTML');
                return true;
            } else {
                console.log(`❌ Missing modal elements: ${missing.join(', ')}`);
                return false;
            }
        } else {
            console.log(`❌ Could not load page to test modal elements`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Modal elements test failed: ${error.message}`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 Starting deployment verification...');
    console.log(`📍 Testing URL: ${CONFIG.deployedUrl}`);
    console.log('');
    
    const tests = [
        { name: 'Main Page', fn: testMainPage },
        { name: 'API Health', fn: testApiHealth },
        { name: 'Static Assets', fn: testStaticAssets },
        { name: 'Modal Elements', fn: testModalElements }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, passed: result });
        } catch (error) {
            console.log(`❌ ${test.name} test crashed: ${error.message}`);
            results.push({ name: test.name, passed: false });
        }
        console.log('');
    }
    
    // Summary
    console.log('📊 Test Results Summary:');
    console.log('========================');
    
    let passedCount = 0;
    results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name}`);
        if (result.passed) passedCount++;
    });
    
    console.log('');
    console.log(`🎯 Overall Result: ${passedCount}/${results.length} tests passed`);
    
    if (passedCount === results.length) {
        console.log('🎉 All tests passed! Deployment is working correctly.');
        process.exit(0);
    } else {
        console.log('⚠️  Some tests failed. Please check the deployment.');
        process.exit(1);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('💥 Test runner crashed:', error);
        process.exit(1);
    });
}

module.exports = {
    testMainPage,
    testApiHealth,
    testStaticAssets,
    testModalElements,
    runAllTests
};
