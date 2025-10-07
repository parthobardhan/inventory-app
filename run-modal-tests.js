/**
 * Test Runner Script for Modal Functionality
 * This script runs specific tests and provides detailed output
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Modal Product Addition Tests...\n');

try {
  // Run unit tests for modal functionality
  console.log('📋 Running Unit Tests...');
  const unitTestResult = execSync('npm run test:unit -- --testNamePattern="Modal Product Addition Tests"', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(unitTestResult);

  console.log('\n📋 Running E2E Tests...');
  const e2eTestResult = execSync('npm test -- __tests__/e2e/modal-e2e.test.js', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(e2eTestResult);

  console.log('\n✅ All modal tests completed successfully!');

} catch (error) {
  console.log('❌ Test execution details:');
  console.log(error.stdout);
  console.log('\n🔍 Error details:');
  console.log(error.stderr);
  
  console.log('\n📝 Test Summary:');
  console.log('- Unit tests check individual modal functions');
  console.log('- Integration tests verify database operations');
  console.log('- E2E tests simulate complete user workflow');
  
  process.exit(1);
}


