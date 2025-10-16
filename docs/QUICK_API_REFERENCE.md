# Quick API Reference - Shared Services

## Product Service

```javascript
const productService = require('./services/productService');
```

### createProduct(productData)
```javascript
const result = await productService.createProduct({
  name: 'Blue Cotton Saree',
  sku: 'SAR-001',  // Optional - auto-generated if not provided
  type: 'sarees',
  quantity: 20,
  price: 120.00,
  cost: 80.00,     // Optional
  description: 'Beautiful blue cotton saree'  // Optional
});
// Returns: { success: true, data: product, message: '...' }
```

### updateProduct(productId, updateData)
```javascript
const result = await productService.updateProduct(productId, {
  price: 130.00,
  quantity: 25
});
```

### updateProductQuantity(identifier, updateData)
```javascript
// Add to quantity
await productService.updateProductQuantity('SAR-001', {
  quantity_change: 10  // Adds 10
});

// Set specific quantity
await productService.updateProductQuantity('SAR-001', {
  new_quantity: 50
});
```

### Other Methods
```javascript
await productService.getProduct('SAR-001');  // By SKU or ID
await productService.getAllProducts({ type: 'sarees', lowStock: true });
await productService.searchProducts({ searchTerm: 'blue', type: 'sarees' });
await productService.deleteProduct(productId);
```

---

## Sales Service

```javascript
const salesService = require('./services/salesService');
```

### recordSale(saleData)
```javascript
const result = await salesService.recordSale({
  productId: '507f1f77bcf86cd799439011',
  sku: 'SAR-001',
  quantity: 5,
  sellPrice: 120.00,
  dateSold: new Date()  // Optional - defaults to now
});
// Automatically reduces product quantity
// Returns: { success: true, data: { sale, product }, message: '...' }
```

### getSales(options)
```javascript
const result = await salesService.getSales({
  productId: '507f1f77bcf86cd799439011',  // Optional
  sku: 'SAR-001',                          // Optional
  startDate: '2024-01-01',                  // Optional
  endDate: '2024-12-31',                    // Optional
  limit: 50                                 // Default: 100
});
```

### Other Methods
```javascript
await salesService.getSale(saleId);
await salesService.getRecentSales(10);
await salesService.getProductSales('SAR-001', 20);
await salesService.deleteSale(saleId);  // Restores inventory
```

---

## Analytics Service

```javascript
const analyticsService = require('./services/analyticsService');
```

### getInventorySummary()
```javascript
const result = await analyticsService.getInventorySummary();
// Returns:
// {
//   totalProducts: 150,
//   totalValue: 15000,
//   productCount: 25,
//   lowStockCount: 3,
//   outOfStockCount: 1,
//   typeBreakdown: { ... }
// }
```

### getProfitStats(period)
```javascript
const result = await analyticsService.getProfitStats('month');
// period: 'today' | 'week' | 'month' | 'year' | 'all'
// Returns:
// {
//   totalProfit: 5000,
//   totalRevenue: 15000,
//   totalCost: 10000,
//   profitMargin: 33.33,
//   profitChange: 15.5,
//   ...
// }
```

### getTopProducts(options)
```javascript
const result = await analyticsService.getTopProducts({
  period: 'month',
  sortBy: 'revenue',  // 'revenue' | 'quantity' | 'profit'
  limit: 10
});
// Returns array of top products with stats
```

### Other Methods
```javascript
await analyticsService.getMonthlyProfits(12);  // Last 12 months
await analyticsService.getLowStockAlerts(10);  // Threshold: 10
await analyticsService.getSalesTrends('month');
```

---

## AI Agent Tools

### Product Tools

**add_product**
```
User: "Add 30 silk cushion covers for $45 SKU CC-003"
Agent extracts: { name: 'Silk Cushion Cover', sku: 'CC-003', type: 'cushion-covers', quantity: 30, price: 45 }
```

**update_product**
```
User: "Update the price of CC-003 to $50"
```

**update_inventory**
```
User: "Add 20 more cushion covers to stock"
```

**search_products**
```
User: "Find all blue sarees"
```

**get_product**
```
User: "Show me details for SKU CC-003"
```

**list_products**
```
User: "List all towels"
```

**delete_product**
```
User: "Delete product CC-003"
```

### Sales Tools

**record_sale**
```
User: "I sold 5 cushion covers for $45 each"
```

**get_sales_history**
```
User: "Show me all sales for CC-003"
User: "Show me sales from January to March"
```

**get_recent_sales**
```
User: "Show me the last 10 sales"
```

### Analytics Tools

**view_analytics**
```
User: "Show me this month's profits"
User: "What's my revenue for the year?"
```

**get_inventory_summary**
```
User: "Give me an inventory summary"
```

**get_top_products**
```
User: "What are my top 5 sellers?"
User: "Show me the most profitable products"
```

**get_low_stock_alerts**
```
User: "Which products need restocking?"
```

**get_sales_trends**
```
User: "Show me sales trends for this month"
```

---

## Response Format

### Success Response
```javascript
{
  success: true,
  data: { ... },          // The actual data
  message: "...",         // Optional success message
  count: 10               // Optional count for arrays
}
```

### Error Response
```javascript
{
  success: false,
  error: "Human-readable error message",
  code: "ERROR_CODE",     // VALIDATION_ERROR, NOT_FOUND, etc.
  details: [],            // Optional additional details
  suggestions: []         // Optional suggestions (e.g., similar products)
}
```

---

## Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `NOT_FOUND` - Resource not found
- `DUPLICATE_SKU` - SKU already exists
- `INSUFFICIENT_STOCK` - Not enough inventory for sale
- `INTERNAL_ERROR` - Server error

---

## Best Practices

### 1. Always Check Success
```javascript
const result = await productService.createProduct(data);
if (result.success) {
  // Handle success
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error);
}
```

### 2. Use Transactions for Sales
```javascript
// Sales service automatically uses transactions
const result = await salesService.recordSale(saleData);
// If it fails, inventory is NOT reduced (atomic operation)
```

### 3. Search Before Update/Delete
```javascript
// Find product first
const searchResult = await productService.searchProducts({
  searchTerm: 'cushion'
});

if (searchResult.success && searchResult.data.length > 0) {
  const product = searchResult.data[0];
  await productService.updateProduct(product._id, updates);
}
```

### 4. Handle Suggestions
```javascript
const result = await productService.updateProductQuantity('Wrong Name', {
  new_quantity: 50
});

if (!result.success && result.suggestions) {
  console.log('Did you mean one of these?', result.suggestions);
}
```

---

## Quick Start Checklist

- [ ] Import the service you need
- [ ] Call the method with required parameters
- [ ] Check `result.success`
- [ ] Handle both success and error cases
- [ ] Use returned data or error message
- [ ] Restart server after code changes
- [ ] Start fresh agent conversation for new tools

---

## Testing

```javascript
// Test product creation
const result = await productService.createProduct({
  name: 'Test Product',
  type: 'towels',
  quantity: 10,
  price: 15.00
});
console.log('SKU:', result.data.sku);  // Auto-generated!

// Test sale recording  
const saleResult = await salesService.recordSale({
  productId: result.data._id,
  sku: result.data.sku,
  quantity: 2,
  sellPrice: 15.00
});

// Test analytics
const analytics = await analyticsService.getProfitStats('month');
console.log('Profit:', analytics.data.totalProfit);
```

---

## Need Help?

- See `docs/services-architecture.md` for detailed architecture
- See `SERVICES_SUMMARY.md` for complete overview
- Check service files for JSDoc documentation
- All methods include detailed comments

