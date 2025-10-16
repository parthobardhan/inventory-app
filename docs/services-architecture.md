# Services Architecture - Shared Business Logic

## Overview
This document describes the shared services architecture that provides consistent business logic for both the web application routes and the AI agent.

## Architecture Diagram

```
┌──────────────────┐         ┌──────────────────┐
│   Web Routes     │         │   AI Agent       │
│  (routes/*.js)   │         │ (agentService)   │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │    ┌─────────────────┐     │
         └────┤  Shared Services ├─────┘
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│ Product      │ │ Sales    │ │ Analytics   │
│ Service      │ │ Service  │ │ Service     │
└───────┬──────┘ └────┬─────┘ └──────┬──────┘
        │             │              │
        └─────────────┼──────────────┘
                      │
              ┌───────▼────────┐
              │   MongoDB      │
              │  (Models)      │
              └────────────────┘
```

## Services Overview

### 1. Product Service (`services/productService.js`)

Handles all product-related operations.

**Methods:**
- `createProduct(productData)` - Create a new product with auto SKU generation
- `updateProduct(productId, updateData)` - Update product details
- `updateProductQuantity(identifier, updateData)` - Update product quantity
- `deleteProduct(productId)` - Delete a product
- `getProduct(identifier)` - Get a single product by ID or SKU
- `getAllProducts(options)` - Get all products with filtering/sorting
- `searchProducts(criteria)` - Search products by various criteria
- `generateSKU(productName)` - Generate unique SKU from product name

**Features:**
- Auto-generates SKU if not provided
- Validates all required fields and data types
- Handles duplicate SKU errors
- Supports search by ID, SKU, or name
- Filters by type, low stock, etc.

### 2. Sales Service (`services/salesService.js`)

Handles all sales-related operations.

**Methods:**
- `recordSale(saleData)` - Record a sale with transaction support
- `getSales(options)` - Get sales with filtering
- `getSale(saleId)` - Get a single sale by ID
- `getRecentSales(limit)` - Get recent sales
- `getProductSales(identifier, limit)` - Get all sales for a product
- `deleteSale(saleId)` - Delete a sale and restore inventory

**Features:**
- Uses MongoDB transactions for data consistency
- Automatically reduces product quantity
- Validates sufficient stock before sale
- Verifies SKU matches
- Calculates profit margins automatically
- Restores quantity when sale is deleted

### 3. Analytics Service (`services/analyticsService.js`)

Handles all analytics and reporting operations.

**Methods:**
- `getInventorySummary()` - Comprehensive inventory statistics
- `getProfitStats(period)` - Profit analysis for time periods
- `getMonthlyProfits(months)` - Monthly profit history
- `getTopProducts(options)` - Top selling products by revenue/quantity/profit
- `getSalesTrends(period)` - Daily sales trends and patterns
- `getLowStockAlerts(threshold)` - Products below stock threshold

**Features:**
- Period-based analysis (today, week, month, year, all)
- Compares current vs previous period
- Calculates profit margins and trends
- Identifies top performers
- Low stock monitoring
- Daily trend analysis

## AI Agent Tools

The AI agent has been extended with 17 tools across all services:

### Product Tools (7 tools)
1. **add_product** - Add new product with auto SKU generation
2. **update_product** - Update product details
3. **update_inventory** - Change product quantity
4. **delete_product** - Remove product
5. **search_products** - Search with filters
6. **get_product** - Get specific product info
7. **list_products** - List all products with filters

### Sales Tools (3 tools)
8. **record_sale** - Record a sale transaction
9. **get_sales_history** - View sales with filters
10. **get_recent_sales** - Get latest sales

### Analytics Tools (7 tools)
11. **view_analytics** - Get profit/revenue analytics
12. **get_inventory_summary** - Overall inventory stats
13. **get_top_products** - Top sellers analysis
14. **get_low_stock_alerts** - Low stock warnings
15. **get_sales_trends** - Sales patterns over time

## Usage Examples

### Using Services in Routes

```javascript
const productService = require('../services/productService');

router.post('/api/products', async (req, res) => {
  const result = await productService.createProduct(req.body);
  
  if (result.success) {
    res.status(201).json({ success: true, data: result.data });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});
```

### Using Services in AI Agent

The agent automatically calls these services based on user intent:

**User:** "Add 30 silk cushion covers for $45 SKU CC-003"
```javascript
// Agent calls:
{
  tool: 'add_product',
  args: {
    name: 'Silk Cushion Cover',
    sku: 'CC-003',
    type: 'cushion-covers',
    quantity: 30,
    price: 45
  }
}
// Internally calls: productService.createProduct()
```

**User:** "Show me sales for this month"
```javascript
// Agent calls:
{
  tool: 'view_analytics',
  args: { period: 'month' }
}
// Internally calls: analyticsService.getProfitStats('month')
```

**User:** "What are my top 5 selling products?"
```javascript
// Agent calls:
{
  tool: 'get_top_products',
  args: { period: 'month', limit: 5 }
}
// Internally calls: analyticsService.getTopProducts()
```

## Benefits

### 1. Code Reusability
- Single source of truth for business logic
- Both web routes and AI agent use the same functions
- No code duplication

### 2. Consistency
- Same validation rules everywhere
- Uniform error handling
- Consistent data structures

### 3. Maintainability
- Changes to business logic in one place
- Easy to add new features
- Clear separation of concerns

### 4. Testability
- Services can be unit tested independently
- Both routes and agent inherit tested behavior
- Easy to mock for testing

### 5. Flexibility
- Easy to add new tools for the agent
- Services can be extended without breaking existing code
- Support for future integrations (APIs, webhooks, etc.)

## Error Handling

All services use a consistent error response format:

```javascript
{
  success: false,
  error: "Human-readable error message",
  code: "ERROR_CODE", // e.g., VALIDATION_ERROR, NOT_FOUND, DUPLICATE_SKU
  details: [] // Optional additional details
}
```

Success response format:

```javascript
{
  success: true,
  data: {}, // The actual data
  message: "Human-readable success message" // Optional
}
```

## Transaction Support

Sales operations use MongoDB transactions to ensure data consistency:

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Create sale
  await sale.save({ session });
  
  // Update product quantity
  product.quantity -= quantity;
  await product.save({ session });
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

## Auto-Generated Features

### SKU Generation
Products automatically get SKU codes if not provided:
- Format: `XXX-NNNNNN` (3 letters + 6 digits)
- Letters from product name (or XXX if no letters)
- Numbers from timestamp for uniqueness

Example: "Silk Cushion Cover" → `SIL-847392`

### Calculated Fields
Sales automatically calculate:
- `totalSaleValue` = quantity × sellPrice
- `totalCost` = quantity × cost
- `profit` = totalSaleValue - totalCost
- `profitMargin` = (profit / totalSaleValue) × 100

## Validation

All services include comprehensive validation:

### Product Validation
- Required: name, type, quantity, price
- Quantity must be non-negative integer
- Price/cost must be non-negative numbers
- Type must be one of: bed-covers, cushion-covers, sarees, towels
- SKU must be unique

### Sales Validation
- Required: productId, sku, quantity, sellPrice
- Quantity must be positive integer
- Sufficient stock must be available
- SKU must match product SKU
- sellPrice must be greater than 0

## Future Enhancements

Potential additions:
1. **Product Categories** - Multi-level categorization
2. **Supplier Management** - Track suppliers and purchase orders
3. **Inventory Transfers** - Move stock between locations
4. **Batch Operations** - Bulk import/export
5. **Advanced Analytics** - Forecasting, seasonality analysis
6. **Notifications** - Email/SMS alerts for low stock
7. **Audit Logging** - Track all changes
8. **Multi-currency** - Support different currencies
9. **Barcode Integration** - Scan products
10. **Returns Management** - Handle sale returns

## Testing

Each service should be tested independently:

```bash
# Run unit tests
npm run test:unit -- productService.test.js
npm run test:unit -- salesService.test.js
npm run test:unit -- analyticsService.test.js

# Run integration tests
npm run test:integration
```

## Migration Guide

### From Old Code
**Before:**
```javascript
router.post('/', async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  // Manual error handling...
});
```

**After:**
```javascript
router.post('/', async (req, res) => {
  const result = await productService.createProduct(req.body);
  
  if (result.success) {
    res.json({ success: true, data: result.data });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});
```

### For New Features
1. Add method to appropriate service
2. Add tool definition to agentService if needed
3. Add tool implementation function
4. Update documentation
5. Write tests

## Conclusion

The shared services architecture provides a robust, maintainable, and scalable foundation for the inventory management system. Both the web application and AI agent benefit from the same validated, tested business logic, ensuring consistency across all access points.

