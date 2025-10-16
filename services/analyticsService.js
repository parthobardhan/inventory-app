const Product = require('../models/Product');
const Sale = require('../models/Sale');

/**
 * Gets comprehensive inventory summary
 * @returns {Promise<Object>} Result with inventory summary
 */
async function getInventorySummary() {
  try {
    const products = await Product.find();
    
    const summary = {
      totalProducts: products.reduce((sum, product) => sum + product.quantity, 0),
      totalValue: products.reduce((sum, product) => sum + product.totalValue, 0),
      productCount: products.length,
      lowStockCount: products.filter(p => p.quantity < 10).length,
      outOfStockCount: products.filter(p => p.quantity === 0).length,
      typeBreakdown: {}
    };
    
    // Calculate type breakdown
    products.forEach(product => {
      if (!summary.typeBreakdown[product.type]) {
        summary.typeBreakdown[product.type] = {
          count: 0,
          value: 0,
          items: 0
        };
      }
      summary.typeBreakdown[product.type].count += product.quantity;
      summary.typeBreakdown[product.type].value += product.totalValue;
      summary.typeBreakdown[product.type].items += 1;
    });
    
    return {
      success: true,
      data: summary
    };
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    return {
      success: false,
      error: `Failed to get inventory summary: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets profit statistics for a given period
 * @param {string} period - Time period ('today', 'week', 'month', 'year', 'all')
 * @returns {Promise<Object>} Result with profit statistics
 */
async function getProfitStats(period = 'month') {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(currentYear, currentMonth, 1);
        break;
      case 'year':
        startDate = new Date(currentYear, 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(currentYear, currentMonth, 1);
    }
    
    // Get sales for the period
    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: now }
    });
    
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalSaleValue, 0);
    const totalCost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
    const totalQuantitySold = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    
    // Calculate previous period for comparison
    const previousPeriodStart = getPreviousPeriodStart(period, currentYear, currentMonth);
    const previousPeriodEnd = startDate;
    
    const previousSales = await Sale.find({
      dateSold: { $gte: previousPeriodStart, $lt: previousPeriodEnd }
    });
    
    const previousProfit = previousSales.reduce((sum, sale) => sum + sale.profit, 0);
    
    const profitChange = previousProfit > 0
      ? ((totalProfit - previousProfit) / previousProfit) * 100
      : 0;
    
    return {
      success: true,
      data: {
        period,
        totalProfit,
        totalRevenue,
        totalCost,
        totalQuantitySold,
        salesCount: sales.length,
        averageProfit: sales.length > 0 ? totalProfit / sales.length : 0,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        previousPeriodProfit: previousProfit,
        profitChange
      }
    };
  } catch (error) {
    console.error('Error getting profit stats:', error);
    return {
      success: false,
      error: `Failed to get profit stats: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Helper function to get previous period start date
 */
function getPreviousPeriodStart(period, currentYear, currentMonth) {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(currentYear, currentMonth - 1, 1);
    case 'year':
      return new Date(currentYear - 1, 0, 1);
    case 'all':
      return new Date(0);
    default:
      return new Date(currentYear, currentMonth - 1, 1);
  }
}

/**
 * Gets monthly profit history for the last N months
 * @param {number} months - Number of months to retrieve (default 12)
 * @returns {Promise<Object>} Result with monthly profit data
 */
async function getMonthlyProfits(months = 12) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthlyProfits = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0);
      
      const monthlySales = await Sale.find({
        dateSold: { $gte: monthStart, $lte: monthEnd }
      });
      
      const monthProfit = monthlySales.reduce((sum, sale) => sum + sale.profit, 0);
      const monthRevenue = monthlySales.reduce((sum, sale) => sum + sale.totalSaleValue, 0);
      
      monthlyProfits.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
        monthName: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
        profit: monthProfit,
        revenue: monthRevenue,
        salesCount: monthlySales.length
      });
    }
    
    return {
      success: true,
      data: monthlyProfits
    };
  } catch (error) {
    console.error('Error getting monthly profits:', error);
    return {
      success: false,
      error: `Failed to get monthly profits: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets top selling products
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Number of products to return (default 10)
 * @param {string} [options.period] - Time period ('today', 'week', 'month', 'year', 'all')
 * @param {string} [options.sortBy] - Sort by 'quantity', 'revenue', or 'profit' (default 'revenue')
 * @returns {Promise<Object>} Result with top products
 */
async function getTopProducts(options = {}) {
  try {
    const { limit = 10, period = 'month', sortBy = 'revenue' } = options;
    
    // Determine date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    // Get sales for the period
    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: now }
    }).populate('productId', 'name type sku');
    
    // Aggregate by product
    const productStats = {};
    
    sales.forEach(sale => {
      const sku = sale.sku;
      if (!productStats[sku]) {
        productStats[sku] = {
          sku: sku,
          productName: sale.productId ? sale.productId.name : 'Unknown',
          productType: sale.productId ? sale.productId.type : 'Unknown',
          quantity: 0,
          revenue: 0,
          profit: 0,
          salesCount: 0
        };
      }
      
      productStats[sku].quantity += sale.quantity;
      productStats[sku].revenue += sale.totalSaleValue;
      productStats[sku].profit += sale.profit;
      productStats[sku].salesCount += 1;
    });
    
    // Convert to array and sort
    let topProducts = Object.values(productStats);
    
    // Sort based on criteria
    topProducts.sort((a, b) => {
      switch (sortBy) {
        case 'quantity':
          return b.quantity - a.quantity;
        case 'profit':
          return b.profit - a.profit;
        case 'revenue':
        default:
          return b.revenue - a.revenue;
      }
    });
    
    // Limit results
    topProducts = topProducts.slice(0, limit);
    
    return {
      success: true,
      data: topProducts,
      count: topProducts.length
    };
  } catch (error) {
    console.error('Error getting top products:', error);
    return {
      success: false,
      error: `Failed to get top products: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets sales trends and patterns
 * @param {string} period - Time period for analysis
 * @returns {Promise<Object>} Result with sales trends
 */
async function getSalesTrends(period = 'month') {
  try {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: now }
    });
    
    // Calculate daily trends
    const dailyTrends = {};
    sales.forEach(sale => {
      const day = sale.dateSold.toISOString().split('T')[0];
      if (!dailyTrends[day]) {
        dailyTrends[day] = {
          date: day,
          salesCount: 0,
          quantity: 0,
          revenue: 0,
          profit: 0
        };
      }
      dailyTrends[day].salesCount += 1;
      dailyTrends[day].quantity += sale.quantity;
      dailyTrends[day].revenue += sale.totalSaleValue;
      dailyTrends[day].profit += sale.profit;
    });
    
    const trendsArray = Object.values(dailyTrends).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    
    // Calculate averages
    const avgRevenue = trendsArray.length > 0
      ? trendsArray.reduce((sum, day) => sum + day.revenue, 0) / trendsArray.length
      : 0;
    
    const avgProfit = trendsArray.length > 0
      ? trendsArray.reduce((sum, day) => sum + day.profit, 0) / trendsArray.length
      : 0;
    
    return {
      success: true,
      data: {
        period,
        dailyTrends: trendsArray,
        averages: {
          dailyRevenue: avgRevenue,
          dailyProfit: avgProfit,
          dailySales: trendsArray.length > 0
            ? trendsArray.reduce((sum, day) => sum + day.salesCount, 0) / trendsArray.length
            : 0
        }
      }
    };
  } catch (error) {
    console.error('Error getting sales trends:', error);
    return {
      success: false,
      error: `Failed to get sales trends: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Gets low stock alerts
 * @param {number} threshold - Stock threshold (default 10)
 * @returns {Promise<Object>} Result with low stock products
 */
async function getLowStockAlerts(threshold = 10) {
  try {
    const products = await Product.find({
      quantity: { $lt: threshold }
    }).sort({ quantity: 1 });
    
    return {
      success: true,
      data: products,
      count: products.length
    };
  } catch (error) {
    console.error('Error getting low stock alerts:', error);
    return {
      success: false,
      error: `Failed to get low stock alerts: ${error.message}`,
      code: 'INTERNAL_ERROR'
    };
  }
}

module.exports = {
  getInventorySummary,
  getProfitStats,
  getMonthlyProfits,
  getTopProducts,
  getSalesTrends,
  getLowStockAlerts
};

