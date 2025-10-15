const OpenAI = require('openai');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define tools that the AI agent can use
const tools = [
  {
    type: 'function',
    function: {
      name: 'add_product',
      description: 'Add a new product to the inventory. Use this when the user wants to add, create, or insert a new product.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the product (e.g., "Blue Cotton T-Shirt", "Silk Bed Cover")',
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
            description: 'The cost price per unit in dollars (optional)',
          },
          description: {
            type: 'string',
            description: 'A description of the product (optional)',
          },
        },
        required: ['name', 'type', 'quantity', 'price'],
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
      name: 'make_sale',
      description: 'Record a sale of a product. Use this when the user mentions selling, sold, or making a sale.',
      parameters: {
        type: 'object',
        properties: {
          product_name: {
            type: 'string',
            description: 'The name or partial name of the product being sold',
          },
          quantity: {
            type: 'number',
            description: 'The quantity being sold',
          },
          sale_price: {
            type: 'number',
            description: 'The actual sale price (optional, defaults to product list price)',
          },
        },
        required: ['product_name', 'quantity'],
      },
    },
  },
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
            enum: ['today', 'week', 'month', 'year', 'all'],
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
      name: 'search_products',
      description: 'Search for products in the inventory. Use this when the user wants to find, search, or look up products.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'The search term (product name, description, or type)',
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
      name: 'open_catalog_page',
      description: 'Provide a link to open a specific catalog page. Use this when the user wants to view or browse a catalog.',
      parameters: {
        type: 'object',
        properties: {
          catalog_type: {
            type: 'string',
            enum: ['bed-covers', 'cushion-covers', 'coverz', 'inventory', 'analytics'],
            description: 'The catalog or page to open',
          },
        },
        required: ['catalog_type'],
      },
    },
  },
];

// Tool execution functions
async function executeTool(toolName, args) {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'add_product':
      return await addProduct(args);
    
    case 'update_inventory':
      return await updateInventory(args);
    
    case 'make_sale':
      return await makeSale(args);
    
    case 'view_analytics':
      return await viewAnalytics(args);
    
    case 'search_products':
      return await searchProducts(args);
    
    case 'open_catalog_page':
      return await openCatalogPage(args);
    
    default:
      return { error: 'Unknown tool', toolName };
  }
}

// Tool implementations
async function addProduct(args) {
  try {
    const product = new Product({
      name: args.name,
      type: args.type,
      quantity: args.quantity,
      price: args.price,
      cost: args.cost || 0,
      description: args.description || '',
      dateAdded: new Date(),
    });

    await product.save();

    return {
      success: true,
      message: `Successfully added ${args.quantity} units of "${args.name}" to inventory.`,
      product: {
        id: product._id,
        name: product.name,
        type: product.type,
        quantity: product.quantity,
        price: product.price,
      },
    };
  } catch (error) {
    console.error('Error adding product:', error);
    return {
      success: false,
      error: `Failed to add product: ${error.message}`,
    };
  }
}

async function updateInventory(args) {
  try {
    // Search for product by name (case-insensitive, partial match)
    const product = await Product.findOne({
      name: { $regex: args.product_name, $options: 'i' },
    });

    if (!product) {
      // Try to find similar products
      const similarProducts = await Product.find({
        name: { $regex: args.product_name.split(' ')[0], $options: 'i' },
      }).limit(5);

      return {
        success: false,
        error: `Product "${args.product_name}" not found.`,
        suggestions: similarProducts.map(p => p.name),
      };
    }

    const oldQuantity = product.quantity;

    if (args.new_quantity !== undefined) {
      product.quantity = args.new_quantity;
    } else if (args.quantity_change !== undefined) {
      product.quantity += args.quantity_change;
    }

    if (product.quantity < 0) {
      return {
        success: false,
        error: `Cannot set quantity below 0. Current quantity is ${oldQuantity}.`,
      };
    }

    await product.save();

    return {
      success: true,
      message: `Updated "${product.name}" quantity from ${oldQuantity} to ${product.quantity}.`,
      product: {
        id: product._id,
        name: product.name,
        oldQuantity,
        newQuantity: product.quantity,
      },
    };
  } catch (error) {
    console.error('Error updating inventory:', error);
    return {
      success: false,
      error: `Failed to update inventory: ${error.message}`,
    };
  }
}

async function makeSale(args) {
  try {
    // Find the product
    const product = await Product.findOne({
      name: { $regex: args.product_name, $options: 'i' },
    });

    if (!product) {
      return {
        success: false,
        error: `Product "${args.product_name}" not found.`,
      };
    }

    if (product.quantity < args.quantity) {
      return {
        success: false,
        error: `Insufficient stock. Only ${product.quantity} units available.`,
      };
    }

    // Calculate sale details
    const salePrice = args.sale_price || product.price;
    const totalRevenue = salePrice * args.quantity;
    const totalCost = (product.cost || 0) * args.quantity;
    const profit = totalRevenue - totalCost;

    // Create sale record
    const sale = new Sale({
      productId: product._id,
      productName: product.name,
      quantity: args.quantity,
      salePrice: salePrice,
      cost: product.cost || 0,
      totalRevenue: totalRevenue,
      profit: profit,
      dateSold: new Date(),
    });

    await sale.save();

    // Update product quantity
    product.quantity -= args.quantity;
    await product.save();

    return {
      success: true,
      message: `Recorded sale of ${args.quantity} units of "${product.name}".`,
      sale: {
        id: sale._id,
        productName: product.name,
        quantity: args.quantity,
        revenue: totalRevenue,
        profit: profit,
        remainingStock: product.quantity,
      },
    };
  } catch (error) {
    console.error('Error making sale:', error);
    return {
      success: false,
      error: `Failed to record sale: ${error.message}`,
    };
  }
}

async function viewAnalytics(args) {
  try {
    const now = new Date();
    let startDate;

    switch (args.period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get sales data
    const sales = await Sale.find({
      dateSold: { $gte: startDate },
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalRevenue, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalSales = sales.length;
    const totalQuantitySold = sales.reduce((sum, sale) => sum + sale.quantity, 0);

    // Get top selling products
    const productSales = {};
    sales.forEach(sale => {
      if (!productSales[sale.productName]) {
        productSales[sale.productName] = { quantity: 0, revenue: 0 };
      }
      productSales[sale.productName].quantity += sale.quantity;
      productSales[sale.productName].revenue += sale.totalRevenue;
    });

    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));

    // Get inventory status
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ quantity: { $lt: 10 } });

    return {
      success: true,
      period: args.period,
      analytics: {
        revenue: totalRevenue.toFixed(2),
        profit: totalProfit.toFixed(2),
        salesCount: totalSales,
        quantitySold: totalQuantitySold,
        topProducts: topProducts,
        inventory: {
          totalProducts,
          lowStockProducts,
        },
      },
    };
  } catch (error) {
    console.error('Error viewing analytics:', error);
    return {
      success: false,
      error: `Failed to get analytics: ${error.message}`,
    };
  }
}

async function searchProducts(args) {
  try {
    let query = {};

    if (args.search_term) {
      query.$or = [
        { name: { $regex: args.search_term, $options: 'i' } },
        { description: { $regex: args.search_term, $options: 'i' } },
      ];
    }

    if (args.type && args.type !== 'all') {
      query.type = args.type;
    }

    if (args.low_stock) {
      query.quantity = { $lt: 10 };
    }

    const products = await Product.find(query).limit(20);

    return {
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        type: p.type,
        quantity: p.quantity,
        price: p.price,
        description: p.description,
      })),
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      success: false,
      error: `Failed to search products: ${error.message}`,
    };
  }
}

async function openCatalogPage(args) {
  const pages = {
    'bed-covers': '/bed-covers',
    'cushion-covers': '/cushion-covers',
    'coverz': '/coverz',
    'inventory': '/inventory.html',
    'analytics': '/analytics.html',
  };

  const url = pages[args.catalog_type];

  return {
    success: true,
    message: `Opening ${args.catalog_type} page...`,
    action: 'navigate',
    url: url,
  };
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
- Add new products to inventory
- Update product quantities
- Record sales
- Search for products
- View sales analytics
- Open catalog pages

Be conversational, friendly, and efficient. When the user makes a request:
1. Understand their intent
2. Use the appropriate tool
3. Provide a clear, human-friendly response about what you did

When providing information, be specific with numbers and details. If a tool execution fails, explain why and suggest alternatives.`,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // First API call to get tool calls
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-4o-mini (the "nano" model)
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

module.exports = {
  chat,
  tools,
  executeTool,
};

