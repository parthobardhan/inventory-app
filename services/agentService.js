const OpenAI = require('openai');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Upload } = require('@aws-sdk/lib-storage');
const { getS3Client, S3_BUCKET, getSignedUrlForKey } = require('../config/aws');

// Import all services
const productService = require('./productService');
const salesService = require('./salesService');
const analyticsService = require('./analyticsService');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define tools that the AI agent can use
const tools = [
  // ==================== PRODUCT TOOLS ====================
  {
    type: 'function',
    function: {
      name: 'add_product',
      description: `Add a new product to the inventory. Use this when the user wants to add, create, or insert a new product.

CRITICAL: When the user mentions a SKU code, extract it properly:
- User says "Add 30 cushion covers for $45 SKU CC-003" → sku: "CC-003"
- User says "Add bed cover with SKU BED-001 for $50" → sku: "BED-001"  
- User says "Add 10 towels for $15" (no SKU mentioned) → sku: undefined (will auto-generate)

DO NOT put the SKU in the description field. Extract the alphanumeric code and put it in the sku parameter.

COST BREAKDOWN INSTRUCTIONS:
When the user mentions multiple cost components, extract them into costBreakdown. Examples:
- "Add cushion cover, material $20, embroidery $10, making charge $5" → costBreakdown: [{category: "Material", amount: 20}, {category: "Embroidery", amount: 10}, {category: "Making Charge", amount: 5}]
- "Add bed cover with material cost $30, embroidery $15, end stitching $8, printing $12" → Extract all into costBreakdown
- Every product must have Material and Embroidery costs at minimum
- Additional categories based on type: cushion-covers (Making Charge), bed-covers (End Stitching, Printing), sarees (Printing)`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the product (e.g., "Blue Cotton Saree", "Silk Bed Cover"). Do NOT include the SKU code in the name.',
          },
          sku: {
            type: 'string',
            description: 'The SKU (Stock Keeping Unit) code ONLY - just the alphanumeric code (e.g., "BED-001", "CC-003", "SAR-123"). If user says "SKU CC-003", extract "CC-003" and put it here. If user says "with SKU BED-001", extract "BED-001". Do NOT include the word "SKU" itself. Optional - will be auto-generated if user does not provide one.',
          },
          type: {
            type: 'string',
            enum: ['bed-covers', 'cushion-covers', 'sarees', 'towels'],
            description: 'The category of the product',
          },
          quantity: {
            type: 'number',
            description: 'The quantity of items to add',
          },
          price: {
            type: 'number',
            description: 'The selling price per unit in dollars',
          },
          cost: {
            type: 'number',
            description: 'The total cost price per unit in dollars (optional, will be calculated from costBreakdown if provided)',
          },
          costBreakdown: {
            type: 'array',
            description: 'Itemized cost breakdown. Required categories: Material, Embroidery. Optional based on type: Making Charge (cushion-covers), End Stitching (bed-covers), Printing (bed-covers, sarees)',
            items: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  enum: ['Material', 'Embroidery', 'Making Charge', 'End Stitching', 'Printing'],
                  description: 'The cost category'
                },
                amount: {
                  type: 'number',
                  description: 'The cost amount in dollars'
                }
              },
              required: ['category', 'amount']
            }
          },
          description: {
            type: 'string',
            description: 'A detailed description of the product (optional). Do NOT put the SKU code here - use the sku parameter instead.',
          },
        },
        required: ['name', 'type', 'quantity', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product',
      description: 'Update an existing product details (name, SKU, price, cost, description, etc). Use this when the user wants to modify product information.',
      parameters: {
        type: 'object',
        properties: {
          product_identifier: {
            type: 'string',
            description: 'Product name, SKU, or ID to update',
          },
          name: {
            type: 'string',
            description: 'New product name (optional)',
          },
          sku: {
            type: 'string',
            description: 'New SKU (optional)',
          },
          type: {
            type: 'string',
            enum: ['bed-covers', 'cushion-covers', 'sarees', 'towels'],
            description: 'New product type (optional)',
          },
          quantity: {
            type: 'number',
            description: 'New quantity (optional)',
          },
          price: {
            type: 'number',
            description: 'New selling price (optional)',
          },
          cost: {
            type: 'number',
            description: 'New cost price (optional)',
          },
          description: {
            type: 'string',
            description: 'New description (optional)',
          },
        },
        required: ['product_identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_inventory',
      description: 'Update the quantity of an existing product. Use this when the user wants to increase, decrease, or change stock levels.',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: 'The name or partial name of the product to update',
          },
          quantity_change: {
            type: 'number',
            description: 'The amount to change the quantity by (positive to add, negative to subtract)',
          },
          new_quantity: {
            type: 'number',
            description: 'Or set a specific new quantity (alternative to quantity_change)',
          },
        },
        required: ['product_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_product',
      description: 'Delete a product from inventory. Use when user wants to remove a product permanently.',
      parameters: {
        type: 'object',
        properties: {
          product_identifier: {
            type: 'string',
            description: 'Product name, SKU, or ID to delete',
          },
        },
        required: ['product_identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for products in the inventory. Use this when the user wants to find, search, or look up products.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'The search term (product name, description, or SKU)',
          },
          type: {
            type: 'string',
            enum: ['bed-covers', 'cushion-covers', 'sarees', 'towels', 'all'],
            description: 'Filter by product type (optional)',
          },
          low_stock: {
            type: 'boolean',
            description: 'Only show products with low stock (quantity < 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Get detailed information about a specific product by name, SKU, or ID.',
      parameters: {
        type: 'object',
        properties: {
          product_identifier: {
            type: 'string',
            description: 'Product name, SKU, or ID',
          },
        },
        required: ['product_identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_products',
      description: 'List all products with optional filtering. Use when user wants to see all products or products of a specific type.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['bed-covers', 'cushion-covers', 'sarees', 'towels', 'all'],
            description: 'Filter by product type (optional)',
          },
          low_stock: {
            type: 'boolean',
            description: 'Only show low stock products',
          },
        },
      },
    },
  },
  
  // ==================== SALES TOOLS ====================
  {
    type: 'function',
    function: {
      name: 'record_sale',
      description: 'Record a sale of a product. Use this when the user mentions selling, sold, or making a sale. This will automatically reduce the product quantity.',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: 'The name, SKU, or ID of the product being sold',
          },
          quantity: {
            type: 'number',
            description: 'The quantity being sold',
          },
          sell_price: {
            type: 'number',
            description: 'The actual sale price per unit (optional, uses product list price if not provided)',
          },
          date_sold: {
            type: 'string',
            description: 'Date of sale in ISO format (optional, defaults to now)',
          },
        },
        required: ['product_name', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_history',
      description: 'Get sales history with optional filtering by product, date range, etc.',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: 'Filter by product name or SKU (optional)',
          },
          start_date: {
            type: 'string',
            description: 'Start date for range (ISO format, optional)',
          },
          end_date: {
            type: 'string',
            description: 'End date for range (ISO format, optional)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of sales to return (default 20)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_sales',
      description: 'Get the most recent sales transactions.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of recent sales to retrieve (default 10)',
          },
        },
      },
    },
  },
  
  // ==================== ANALYTICS TOOLS ====================
  {
    type: 'function',
    function: {
      name: 'view_analytics',
      description: 'Get sales analytics and insights. Use this when the user asks about sales, revenue, profit, or performance.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', '2months', 'year', 'all'],
            description: 'The time period for analytics',
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inventory_summary',
      description: 'Get comprehensive inventory summary including total products, value, low stock alerts, and breakdown by type.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description: 'Get top selling products ranked by revenue, quantity sold, or profit. Returns product name, SKU, and profit information.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', '2months', 'year', 'all'],
            description: 'Time period for analysis',
          },
          sort_by: {
            type: 'string',
            enum: ['revenue', 'quantity', 'profit'],
            description: 'What to rank by (default: revenue)',
          },
          limit: {
            type: 'number',
            description: 'Number of top products to return (default 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_alerts',
      description: 'Get products that are low in stock or out of stock.',
      parameters: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Stock threshold for alerts (default 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_trends',
      description: 'Get sales trends and patterns over time.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month', '2months', 'year'],
            description: 'Period for trend analysis',
          },
        },
      },
    },
  },
];

// Tool execution functions
async function executeTool(toolName, args) {
  console.log(`Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      // ==================== PRODUCT OPERATIONS ====================
      case 'add_product':
        return await addProduct(args);
      
      case 'update_product':
        return await updateProductDetails(args);
      
      case 'update_inventory':
        return await updateInventory(args);
      
      case 'delete_product':
        return await deleteProduct(args);
      
      case 'search_products':
        return await searchProducts(args);
      
      case 'get_product':
        return await getProduct(args);
      
      case 'list_products':
        return await listProducts(args);
      
      // ==================== SALES OPERATIONS ====================
      case 'record_sale':
        return await recordSale(args);
      
      case 'get_sales_history':
        return await getSalesHistory(args);
      
      case 'get_recent_sales':
        return await getRecentSales(args);
      
      // ==================== ANALYTICS OPERATIONS ====================
      case 'view_analytics':
        return await viewAnalytics(args);
      
      case 'get_inventory_summary':
        return await getInventorySummary();
      
      case 'get_top_products':
        return await getTopProducts(args);
      
      case 'get_low_stock_alerts':
        return await getLowStockAlerts(args);
      
      case 'get_sales_trends':
        return await getSalesTrends(args);
      
      default:
        return { error: 'Unknown tool', toolName };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      success: false,
      error: `Tool execution failed: ${error.message}`,
    };
  }
}

// ==================== PRODUCT TOOL IMPLEMENTATIONS ====================
async function addProduct(args) {
  const Product = require('../models/Product');
  
  // Use the cost provided by the user (either manual entry or calculated from breakdown)
  // Do NOT auto-calculate - respect the user's input
  const totalCost = args.cost || 0;
  
  const result = await productService.createProduct({
    name: args.name,
    sku: args.sku,
    type: args.type,
    quantity: args.quantity,
    price: args.price,
    cost: totalCost,
    costBreakdown: args.costBreakdown,
    description: args.description
  });

  if (result.success) {
    // If image data was passed, associate it with the product
    if (args._imageData) {
      try {
        console.log('🖼️  Associating uploaded image with product...');
        const product = await Product.findById(result.data._id);
        if (product) {
          product.images = product.images || [];
          product.images.push({
            id: uuidv4(),
            s3Key: args._imageData.s3Key,
            s3Bucket: args._imageData.s3Bucket,
            url: args._imageData.url,
            filename: args._imageData.filename,
            mimetype: args._imageData.mimetype,
            size: args._imageData.size,
            uploadedAt: new Date()
          });
          await product.save();
          console.log('✅ Image associated with product');
        }
      } catch (imageError) {
        console.error('⚠️  Failed to associate image with product:', imageError);
        // Don't fail the whole operation if image association fails
      }
    }
    
    // Build cost breakdown message
    let costMessage = '';
    if (result.data.costBreakdown && result.data.costBreakdown.length > 0) {
      const breakdownStr = result.data.costBreakdown
        .map(item => `${item.category}: $${item.amount.toFixed(2)}`)
        .join(', ');
      costMessage = ` Cost breakdown: ${breakdownStr}. Total cost: $${result.data.cost.toFixed(2)}.`;
    }
    
    return {
      success: true,
      message: `Successfully added ${args.quantity} units of "${args.name}" (SKU: ${result.data.sku}) to inventory.${costMessage}${args._imageData ? ' Product image has been saved.' : ''}`,
      product: {
        id: result.data._id,
        name: result.data.name,
        sku: result.data.sku,
        type: result.data.type,
        quantity: result.data.quantity,
        price: result.data.price,
        cost: result.data.cost,
        costBreakdown: result.data.costBreakdown,
        hasImage: !!args._imageData,
      },
    };
  } else {
    return {
      success: false,
      error: result.error,
    };
  }
}

async function updateProductDetails(args) {
  // First, get the product
  const getResult = await productService.getProduct(args.product_identifier);
  
  if (!getResult.success) {
    // Try searching by name
    const searchResult = await productService.searchProducts({
      searchTerm: args.product_identifier
    });
    
    if (searchResult.success && searchResult.data.length > 0) {
      const product = searchResult.data[0];
      const updateResult = await productService.updateProduct(product._id, args);
      
      if (updateResult.success) {
        return {
          success: true,
          message: `Successfully updated product "${updateResult.data.name}".`,
          product: updateResult.data
        };
      } else {
        return {
          success: false,
          error: updateResult.error
        };
      }
    } else {
      return {
        success: false,
        error: `Product "${args.product_identifier}" not found.`
      };
    }
  } else {
    const updateResult = await productService.updateProduct(getResult.data._id, args);
    
    if (updateResult.success) {
      return {
        success: true,
        message: `Successfully updated product "${updateResult.data.name}".`,
        product: updateResult.data
      };
    } else {
      return {
        success: false,
        error: updateResult.error
      };
    }
  }
}

async function updateInventory(args) {
  const result = await productService.updateProductQuantity(args.product_name, {
    quantity_change: args.quantity_change,
    new_quantity: args.new_quantity
  });

  if (result.success) {
    return {
      success: true,
      message: result.message,
      product: result.data,
    };
  } else {
    return {
      success: false,
      error: result.error,
      suggestions: result.suggestions,
    };
  }
}

async function deleteProduct(args) {
  // First, get the product to get its ID
  const getResult = await productService.getProduct(args.product_identifier);
  
  if (!getResult.success) {
    // Try searching by name
    const searchResult = await productService.searchProducts({
      searchTerm: args.product_identifier
    });
    
    if (searchResult.success && searchResult.data.length > 0) {
      const product = searchResult.data[0];
      const deleteResult = await productService.deleteProduct(product._id);
      
      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully deleted product "${deleteResult.data.name}".`
        };
      } else {
        return {
          success: false,
          error: deleteResult.error
        };
      }
    } else {
      return {
        success: false,
        error: `Product "${args.product_identifier}" not found.`
      };
    }
  } else {
    const deleteResult = await productService.deleteProduct(getResult.data._id);
    
    if (deleteResult.success) {
      return {
        success: true,
        message: `Successfully deleted product "${deleteResult.data.name}".`
      };
    } else {
      return {
        success: false,
        error: deleteResult.error
      };
    }
  }
}

async function searchProducts(args) {
  const result = await productService.searchProducts({
    searchTerm: args.search_term,
    type: args.type,
    lowStock: args.low_stock
  });

  if (result.success) {
    return {
      success: true,
      count: result.count,
      products: result.data.map(p => ({
        id: p._id,
        name: p.name,
        sku: p.sku,
        type: p.type,
        quantity: p.quantity,
        price: p.price,
        description: p.description,
      })),
    };
  } else {
    return {
      success: false,
      error: result.error,
    };
  }
}

async function getProduct(args) {
  const result = await productService.getProduct(args.product_identifier);
  
  if (result.success) {
    return {
      success: true,
      product: {
        id: result.data._id,
        name: result.data.name,
        sku: result.data.sku,
        type: result.data.type,
        quantity: result.data.quantity,
        price: result.data.price,
        cost: result.data.cost,
        description: result.data.description,
        totalValue: result.data.totalValue
      }
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function listProducts(args) {
  const result = await productService.getAllProducts({
    type: args.type,
    lowStock: args.low_stock
  });

  if (result.success) {
    return {
      success: true,
      count: result.count,
      products: result.data.map(p => ({
        id: p._id,
        name: p.name,
        sku: p.sku,
        type: p.type,
        quantity: p.quantity,
        price: p.price,
      })),
    };
  } else {
    return {
      success: false,
      error: result.error,
    };
  }
}

// ==================== SALES TOOL IMPLEMENTATIONS ====================
async function recordSale(args) {
  // First, find the product
  const getResult = await productService.getProduct(args.product_name);
  
  if (!getResult.success) {
    // Try searching by name
    const searchResult = await productService.searchProducts({
      searchTerm: args.product_name
    });
    
    if (searchResult.success && searchResult.data.length > 0) {
      const product = searchResult.data[0];
      
      const saleResult = await salesService.recordSale({
        productId: product._id,
        sku: product.sku,
        quantity: args.quantity,
        sellPrice: args.sell_price || product.price,
        dateSold: args.date_sold ? new Date(args.date_sold) : new Date()
      });
      
      if (saleResult.success) {
        return {
          success: true,
          message: saleResult.message,
          sale: {
            quantity: saleResult.data.sale.quantity,
            sellPrice: saleResult.data.sale.sellPrice,
            totalValue: saleResult.data.sale.totalSaleValue,
            profit: saleResult.data.sale.profit,
            remainingStock: saleResult.data.product.remainingQuantity
          }
        };
      } else {
        return {
          success: false,
          error: saleResult.error
        };
      }
    } else {
      return {
        success: false,
        error: `Product "${args.product_name}" not found.`
      };
    }
  } else {
    const product = getResult.data;
    
    const saleResult = await salesService.recordSale({
      productId: product._id,
      sku: product.sku,
      quantity: args.quantity,
      sellPrice: args.sell_price || product.price,
      dateSold: args.date_sold ? new Date(args.date_sold) : new Date()
    });
    
    if (saleResult.success) {
      return {
        success: true,
        message: saleResult.message,
        sale: {
          quantity: saleResult.data.sale.quantity,
          sellPrice: saleResult.data.sale.sellPrice,
          totalValue: saleResult.data.sale.totalSaleValue,
          profit: saleResult.data.sale.profit,
          remainingStock: saleResult.data.product.remainingQuantity
        }
      };
    } else {
      return {
        success: false,
        error: saleResult.error
      };
    }
  }
}

async function getSalesHistory(args) {
  const options = {
    limit: args.limit || 20
  };
  
  if (args.product_name) {
    // Get product first to get its ID or SKU
    const getResult = await productService.getProduct(args.product_name);
    if (getResult.success) {
      options.productId = getResult.data._id;
    } else {
      options.sku = args.product_name;
    }
  }
  
  if (args.start_date) options.startDate = args.start_date;
  if (args.end_date) options.endDate = args.end_date;
  
  const result = await salesService.getSales(options);
  
  if (result.success) {
    return {
      success: true,
      count: result.count,
      sales: result.data.map(s => ({
        id: s._id,
        product: s.productId ? s.productId.name : 'Unknown',
        sku: s.sku,
        quantity: s.quantity,
        sellPrice: s.sellPrice,
        totalValue: s.totalSaleValue,
        profit: s.profit,
        dateSold: s.dateSold
      }))
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function getRecentSales(args) {
  const result = await salesService.getRecentSales(args.limit || 10);
  
  if (result.success) {
    return {
      success: true,
      count: result.count,
      sales: result.data.map(s => ({
        id: s._id,
        product: s.productId ? s.productId.name : 'Unknown',
        sku: s.sku,
        quantity: s.quantity,
        sellPrice: s.sellPrice,
        totalValue: s.totalSaleValue,
        profit: s.profit,
        dateSold: s.dateSold
      }))
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

// ==================== ANALYTICS TOOL IMPLEMENTATIONS ====================
async function viewAnalytics(args) {
  const result = await analyticsService.getProfitStats(args.period);
  
  if (result.success) {
    const data = result.data;
    return {
      success: true,
      period: data.period,
      analytics: {
        revenue: data.totalRevenue.toFixed(2),
        profit: data.totalProfit.toFixed(2),
        cost: data.totalCost.toFixed(2),
        salesCount: data.salesCount,
        quantitySold: data.totalQuantitySold,
        averageProfit: data.averageProfit.toFixed(2),
        profitMargin: data.profitMargin.toFixed(2) + '%',
        profitChange: data.profitChange.toFixed(2) + '%'
      }
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function getInventorySummary() {
  const result = await analyticsService.getInventorySummary();
  
  if (result.success) {
    return {
      success: true,
      summary: result.data
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function getTopProducts(args) {
  const result = await analyticsService.getTopProducts({
    period: args.period || 'month',
    sortBy: args.sort_by || 'revenue',
    limit: args.limit || 10
  });
  
  if (result.success) {
    return {
      success: true,
      count: result.count,
      topProducts: result.data
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function getLowStockAlerts(args) {
  const result = await analyticsService.getLowStockAlerts(args.threshold || 10);
  
  if (result.success) {
    return {
      success: true,
      count: result.count,
      lowStockProducts: result.data.map(p => ({
        id: p._id,
        name: p.name,
        sku: p.sku,
        type: p.type,
        quantity: p.quantity,
        price: p.price
      }))
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

async function getSalesTrends(args) {
  const result = await analyticsService.getSalesTrends(args.period || 'month');
  
  if (result.success) {
    return {
      success: true,
      trends: result.data
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

// Main agent chat function
async function chat(userMessage, conversationHistory = []) {
  try {
    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for a textile inventory management system. You help users manage their inventory of bed covers, cushion covers, sarees, and towels.

You can:
- Add, update, delete, and search products
- Update product quantities
- Record sales transactions
- View sales analytics and profit statistics
- Get top selling products
- View low stock alerts
- Analyze sales trends

Be conversational, friendly, and efficient. When the user makes a request:
1. Understand their intent
2. Use the appropriate tool(s)
3. Provide a clear, human-friendly response about what you did

When providing information, be specific with numbers and details. If a tool execution fails, explain why and suggest alternatives.

IMPORTANT: If user's intent was to modify a product, inventory or a previous transaction, only update the parameter they are looking to modify. Do not update other parameters that are not mentioned.
IMPORTANT: When extracting SKU codes from user input, extract ONLY the alphanumeric code (e.g., "CC-003", "BED-001") and do NOT include the word "SKU" itself.

SPECIAL INSTRUCTIONS FOR TOP PRODUCTS:
When the user asks about "top products" or "best selling products", provide comprehensive insights:
1. Call get_top_products with period='all' to get the all-time top selling product
2. Call get_top_products with period='2months' to get the top product from the last 2 months
3. In your response, clearly present BOTH:
   - All-Time Top Product: Include product name, SKU, and total profit
   - Recent Top Product (Last 2 Months): Include product name, SKU, and profit for that period
4. If the products differ, explain the difference (e.g., "While X has been your best seller overall, Y has been performing exceptionally well recently")
5. Always sort by 'quantity' to identify which product sold the most units`,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // First API call to get tool calls
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
    });

    const responseMessage = response.choices[0].message;

    // If there are tool calls, execute them
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Execute all tool calls
      const toolResults = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        const result = await executeTool(functionName, functionArgs);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result),
        });
      }

      // Add assistant's response and tool results to messages
      messages.push(responseMessage);
      messages.push(...toolResults);

      // Get final response from the model
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
      });

      const finalMessage = finalResponse.choices[0].message;

      return {
        success: true,
        message: finalMessage.content,
        toolsUsed: responseMessage.tool_calls.map(tc => tc.function.name),
        toolResults: toolResults.map(tr => JSON.parse(tr.content)),
      };
    } else {
      // No tool calls needed, just return the response
      return {
        success: true,
        message: responseMessage.content,
        toolsUsed: [],
        toolResults: [],
      };
    }
  } catch (error) {
    console.error('Agent chat error:', error);
    return {
      success: false,
      error: error.message,
      message: "I'm sorry, I encountered an error processing your request. Please try again.",
    };
  }
}

// Helper function to upload image buffer to S3
async function uploadImageToS3(imageFile) {
  try {
    const s3Client = getS3Client();
    const key = `products/${uuidv4()}-${imageFile.originalname}`;
    
    console.log(`📤 Uploading image to S3: ${key}`);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: key,
        Body: imageFile.buffer,
        ContentType: imageFile.mimetype,
      },
    });

    const result = await upload.done();
    console.log(`✅ Image uploaded to S3: ${key}`);
    
    // Generate signed URL
    const signedUrl = await getSignedUrlForKey(key, 86400); // 24 hours
    
    return {
      s3Key: key,
      s3Bucket: S3_BUCKET,
      url: signedUrl,
      filename: imageFile.originalname,
      mimetype: imageFile.mimetype,
      size: imageFile.size,
    };
  } catch (error) {
    console.error('❌ Error uploading image to S3:', error);
    throw error;
  }
}

// Store for temporary image data during chat processing
const chatImageContext = new Map();

// Chat function with image support
async function chatWithImage(userMessage, imageFile, conversationHistory = []) {
  try {
    console.log('🖼️  Processing chat request with image...');
    
    // Upload image to S3 first (like the modal does)
    let uploadedImage = null;
    try {
      uploadedImage = await uploadImageToS3(imageFile);
      console.log('✅ Image uploaded, URL:', uploadedImage.url);
      
      // Store image data temporarily (will be used by add_product tool)
      const contextId = uuidv4();
      chatImageContext.set(contextId, uploadedImage);
      
      // Clean up old context entries (older than 5 minutes)
      for (const [key, value] of chatImageContext.entries()) {
        if (value.timestamp && Date.now() - value.timestamp > 300000) {
          chatImageContext.delete(key);
        }
      }
      
      // Add timestamp
      uploadedImage.timestamp = Date.now();
      uploadedImage.contextId = contextId;
    } catch (uploadError) {
      console.error('Failed to upload image:', uploadError);
      // Continue anyway with vision analysis
    }
    
    // Convert image buffer to base64 for vision analysis
    const base64Image = imageFile.buffer.toString('base64');
    const imageDataUrl = `data:${imageFile.mimetype};base64,${base64Image}`;
    
    // Build messages array with conversation history and image
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for a textile inventory management system. You help users manage their inventory of bed covers, cushion covers, sarees, and towels.

The user has uploaded an image of a product. Your task is to:
1. Analyze the image to understand what type of product it is
2. Extract any details from the image (colors, patterns, materials, etc.)
3. Combine this with the user's message to understand their intent
4. Use the appropriate tool(s) to fulfill their request

When the user wants to add a product with an image:
- Identify the product type from the image (bed-covers, cushion-covers, sarees, or towels)
- Extract visual details (colors, patterns, materials) to use in the product description
- Use the information from their message (quantity, price, SKU if mentioned)
- Call the add_product tool with all this information
- The image has been uploaded and will be automatically associated with the product

Be conversational, friendly, and efficient.${uploadedImage ? `\n\nNote: The image has been successfully uploaded and stored.` : ''}

SPECIAL INSTRUCTIONS FOR TOP PRODUCTS:
When the user asks about "top products" or "best selling products", provide comprehensive insights:
1. Call get_top_products with period='all' to get the all-time top selling product
2. Call get_top_products with period='2months' to get the top product from the last 2 months
3. In your response, clearly present BOTH:
   - All-Time Top Product: Include product name, SKU, and total profit
   - Recent Top Product (Last 2 Months): Include product name, SKU, and profit for that period
4. If the products differ, explain the difference (e.g., "While X has been your best seller overall, Y has been performing exceptionally well recently")
5. Always sort by 'quantity' to identify which product sold the most units`,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
              detail: 'high',
            },
          },
        ],
      },
    ];

    console.log('🤖 Calling OpenAI with vision...');

    // First API call to get tool calls (with vision)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseMessage = response.choices[0].message;

    // If there are tool calls, execute them
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log('🔧 Executing tools:', responseMessage.tool_calls.map(tc => tc.function.name).join(', '));
      
      // Execute all tool calls
      const toolResults = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`📞 Calling tool: ${functionName}`, functionArgs);
        
        // Pass image context to add_product if available
        if (functionName === 'add_product' && uploadedImage) {
          functionArgs._imageData = uploadedImage;
        }
        
        const result = await executeTool(functionName, functionArgs);
        
        // Clean up context after use
        if (functionName === 'add_product' && uploadedImage) {
          chatImageContext.delete(uploadedImage.contextId);
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result),
        });
      }

      // Add assistant's response and tool results to messages
      messages.push(responseMessage);
      messages.push(...toolResults);

      // Get final response from the model
      console.log('💬 Getting final response...');
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
      });

      const finalMessage = finalResponse.choices[0].message;

      return {
        success: true,
        message: finalMessage.content,
        toolsUsed: responseMessage.tool_calls.map(tc => tc.function.name),
        toolResults: toolResults.map(tr => JSON.parse(tr.content)),
      };
    } else {
      // No tool calls needed, just return the response
      return {
        success: true,
        message: responseMessage.content,
        toolsUsed: [],
        toolResults: [],
      };
    }
  } catch (error) {
    console.error('❌ Agent chat with image error:', error);
    return {
      success: false,
      error: error.message,
      message: "I'm sorry, I encountered an error processing your image. Please try again.",
    };
  }
}

module.exports = {
  chat,
  chatWithImage,
  tools,
  executeTool,
};
