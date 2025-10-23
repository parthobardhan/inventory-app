const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Middleware to check database connection
const checkDBConnection = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('🔄 [DB] Establishing database connection for request...');
      
      try {
        if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('username:password')) {
          throw new Error('MongoDB URI not configured');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          maxPoolSize: 1,
          minPoolSize: 0,
          maxIdleTimeMS: 30000,
          connectTimeoutMS: 5000,
        });
        
        console.warn('✅ [DB] Database connection established for request');
      } catch (error) {
        console.error('❌ [DB] Failed to connect to database:', error.message);
        return res.status(503).json({
          success: false,
          message: 'Database connection not available',
          error: 'Service temporarily unavailable'
        });
      }
    }
    next();
  } catch (error) {
    console.error('Database connection check failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Database connection not available',
      error: 'Service temporarily unavailable'
    });
  }
};

// Helper function to get date range
function getDateRange(period) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      // First day of current month
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case '2months':
      // 60 days ago
      startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      // First day of current year
      startDate = new Date(currentYear, 0, 1);
      break;
    case 'all':
      startDate = new Date(0); // Unix epoch
      break;
    default:
      // Default to current month
      startDate = new Date(currentYear, currentMonth, 1);
  }

  return { startDate, endDate: now };
}

// GET /api/analytics/summary - Get inventory summary
router.get('/summary', checkDBConnection, async (req, res) => {
  try {
    const products = await Product.find({});
    
    const summary = {
      totalProducts: products.length,
      totalValue: 0,
      totalCost: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      byType: {}
    };

    products.forEach(product => {
      const value = product.price * product.quantity;
      const cost = (product.cost || 0) * product.quantity;
      
      summary.totalValue += value;
      summary.totalCost += cost;

      if (product.quantity === 0) {
        summary.outOfStockCount++;
      } else if (product.quantity < 10) {
        summary.lowStockCount++;
      }

      // Count by type
      if (!summary.byType[product.type]) {
        summary.byType[product.type] = {
          count: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }
      summary.byType[product.type].count++;
      summary.byType[product.type].totalQuantity += product.quantity;
      summary.byType[product.type].totalValue += value;
    });

    return res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error getting inventory summary:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get inventory summary'
    });
  }
});

// GET /api/analytics/profit - Get profit statistics for a period
router.get('/profit', checkDBConnection, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: endDate }
    });

    const stats = {
      period,
      salesCount: sales.length,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      averageProfit: 0,
      profitMargin: 0
    };

    sales.forEach(sale => {
      stats.totalRevenue += sale.totalSaleValue || 0;
      stats.totalCost += sale.totalCost || 0;
      stats.totalProfit += sale.profit || 0;
    });

    if (sales.length > 0) {
      stats.averageProfit = stats.totalProfit / sales.length;
    }

    if (stats.totalRevenue > 0) {
      stats.profitMargin = (stats.totalProfit / stats.totalRevenue) * 100;
    }

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting profit stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get profit statistics'
    });
  }
});

// GET /api/analytics/monthly-profits - Get monthly profit breakdown
router.get('/monthly-profits', checkDBConnection, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const numMonths = parseInt(months);

    const sales = await Sale.aggregate([
      {
        $match: {
          dateSold: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - numMonths))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$dateSold' },
            month: { $month: '$dateSold' }
          },
          totalRevenue: { $sum: '$totalSaleValue' },
          totalProfit: { $sum: '$profit' },
          salesCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: numMonths
      }
    ]);

    const monthlyData = sales.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.totalRevenue,
      profit: item.totalProfit,
      salesCount: item.salesCount
    }));

    return res.json({
      success: true,
      data: monthlyData
    });

  } catch (error) {
    console.error('Error getting monthly profits:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get monthly profits'
    });
  }
});

// GET /api/analytics/top-products - Get top selling products
router.get('/top-products', checkDBConnection, async (req, res) => {
  try {
    const { period = 'month', sortBy = 'revenue', limit = 5 } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const maxLimit = parseInt(limit);

    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: endDate }
    }).populate('productId', 'name sku type');

    // Group by product
    const productMap = {};
    sales.forEach(sale => {
      if (!sale.productId) return;
      
      const productId = sale.productId._id.toString();
      if (!productMap[productId]) {
        productMap[productId] = {
          name: sale.productId.name,
          sku: sale.productId.sku,
          type: sale.productId.type,
          totalRevenue: 0,
          totalQuantity: 0,
          totalProfit: 0,
          salesCount: 0
        };
      }

      productMap[productId].totalRevenue += sale.totalSaleValue || 0;
      productMap[productId].totalQuantity += sale.quantity;
      productMap[productId].totalProfit += sale.profit || 0;
      productMap[productId].salesCount++;
    });

    // Convert to array and sort
    let topProducts = Object.values(productMap);

    switch (sortBy) {
      case 'quantity':
        topProducts.sort((a, b) => b.totalQuantity - a.totalQuantity);
        break;
      case 'profit':
        topProducts.sort((a, b) => b.totalProfit - a.totalProfit);
        break;
      case 'revenue':
      default:
        topProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    topProducts = topProducts.slice(0, maxLimit);

    return res.json({
      success: true,
      count: topProducts.length,
      data: topProducts
    });

  } catch (error) {
    console.error('Error getting top products:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get top products'
    });
  }
});

// GET /api/analytics/low-stock - Get low stock products
router.get('/low-stock', checkDBConnection, async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const maxThreshold = parseInt(threshold);

    const products = await Product.find({
      quantity: { $lt: maxThreshold }
    }).sort({ quantity: 1 });

    return res.json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error getting low stock products:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get low stock alerts'
    });
  }
});

// GET /api/analytics/trends - Get sales trends
router.get('/trends', checkDBConnection, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const sales = await Sale.find({
      dateSold: { $gte: startDate, $lte: endDate }
    }).sort({ dateSold: 1 });

    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const averagePerDay = daysDiff > 0 ? sales.length / daysDiff : 0;

    // Calculate trend (comparing first half vs second half)
    const midPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    const firstHalfSales = sales.filter(s => s.dateSold < midPoint).length;
    const secondHalfSales = sales.filter(s => s.dateSold >= midPoint).length;

    let trend = 'stable';
    if (secondHalfSales > firstHalfSales * 1.1) {
      trend = 'increasing';
    } else if (secondHalfSales < firstHalfSales * 0.9) {
      trend = 'decreasing';
    }

    return res.json({
      success: true,
      data: {
        period,
        totalSales: sales.length,
        averagePerDay: parseFloat(averagePerDay.toFixed(2)),
        trend,
        firstHalfSales,
        secondHalfSales
      }
    });

  } catch (error) {
    console.error('Error getting sales trends:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sales trends'
    });
  }
});

module.exports = router;

