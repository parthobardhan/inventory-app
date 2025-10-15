
class AnalyticsDashboard {
    constructor() {
        this.apiBase = '/api/products';
        this.pieChart = null;
        this.barChart = null;
        this.profitChart = null;
        this.colors = {
            'bed-covers': '#0d6efd',      // Bootstrap primary blue
            'cushion-covers': '#198754',   // Bootstrap success green
            'sarees': '#6f42c1',          // Bootstrap purple
            'towels': '#dc3545'           // Bootstrap danger red
        };
        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadAnalyticsData(),
                this.loadProfitData()
            ]);
        } catch (error) {
            console.error('Error initializing analytics dashboard:', error);
            this.showError('Failed to initialize analytics dashboard');
        }
    }

    async loadAnalyticsData() {
        try {
            const response = await fetch(`${this.apiBase}/stats/summary`);
            const result = await response.json();

            if (result.success) {
                const data = result.data;
                this.analyticsData = data;
                this.hideLoading();
                
                if (data.productCount === 0) {
                    this.showEmptyState();
                } else {
                    this.showAnalyticsContent();
                    this.updateMetrics(data);
                    this.renderPieChart(data.typeBreakdown);
                    this.renderBarChart(data.typeBreakdown);
                }
            } else {
                throw new Error(result.message || 'Failed to fetch analytics data');
            }
        } catch (error) {
            console.error('Error loading analytics data:', error);
            this.hideLoading();
            this.showError(error.message);
        }
    }

    async loadProfitData() {
        try {
            const response = await fetch(`${this.apiBase}/stats/profits`);
            const result = await response.json();

            if (result.success) {
                const data = result.data;
                this.profitData = data;
                this.updateProfitMetrics(data);
                this.renderProfitChart(data.monthlyProfits);
            } else {
                console.warn('Failed to fetch profit data:', result.message);
                // Set default profit values
                this.updateProfitMetrics({
                    currentMonth: 0,
                    lastMonth: 0,
                    monthlyProfits: []
                });
            }
        } catch (error) {
            console.error('Error loading profit data:', error);
            // Set default profit values on error
            this.updateProfitMetrics({
                currentMonth: 0,
                lastMonth: 0,
                monthlyProfits: []
            });
        }
    }

    updateMetrics(data) {
        document.getElementById('totalProductsMetric').textContent = data.totalProducts.toLocaleString();
        document.getElementById('totalValueMetric').textContent = `$${data.totalValue.toFixed(2)}`;
    }

    updateProfitMetrics(data) {
        const currentMonthElement = document.getElementById('currentMonthProfitMetric');
        const lastMonthElement = document.getElementById('lastMonthProfitMetric');
        
        if (currentMonthElement) {
            // Use correct property name from API response
            const currentMonth = data.currentMonth || data.currentMonthProfit || 0;
            currentMonthElement.textContent = `$${currentMonth.toFixed(2)}`;
        }
        
        if (lastMonthElement) {
            // Use correct property name from API response
            const lastMonth = data.lastMonth || data.lastMonthProfit || 0;
            lastMonthElement.textContent = `$${lastMonth.toFixed(2)}`;
        }
    }

    renderPieChart(typeBreakdown) {
        const ctx = document.getElementById('pieChart').getContext('2d');
        
        const labels = [];
        const data = [];
        const backgroundColor = [];
        
        Object.entries(typeBreakdown).forEach(([type, typeData]) => {
            labels.push(this.formatProductType(type));
            data.push(typeData.count);
            backgroundColor.push(this.colors[type] || '#6c757d');
        });

        if (this.pieChart) {
            this.pieChart.destroy();
        }

        this.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} items (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderBarChart(typeBreakdown) {
        const ctx = document.getElementById('barChart').getContext('2d');
        
        const labels = [];
        const data = [];
        const backgroundColor = [];
        
        Object.entries(typeBreakdown).forEach(([type, typeData]) => {
            labels.push(this.formatProductType(type));
            data.push(typeData.value);
            backgroundColor.push(this.colors[type] || '#6c757d');
        });

        if (this.barChart) {
            this.barChart.destroy();
        }

        this.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inventory Value',
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 1,
                    borderColor: backgroundColor.map(color => color + '80') // Add transparency
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Value: $${context.parsed.x.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Inventory Value ($)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Product Types'
                        }
                    }
                }
            }
        });
    }

    renderProfitChart(monthlyProfits) {
        const ctx = document.getElementById('profitChart').getContext('2d');
        
        const labels = [];
        const data = [];
        
        monthlyProfits.forEach(monthData => {
            // Convert YYYY-MM to more readable format
            const date = new Date(monthData.month + '-01');
            labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
            data.push(monthData.profit);
        });

        if (this.profitChart) {
            this.profitChart.destroy();
        }

        this.profitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Profit',
                    data: data,
                    backgroundColor: '#0d6efd',
                    borderColor: '#0a58ca',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                return `Profit: $${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Profit ($)'
                        }
                    }
                }
            }
        });
    }

    formatProductType(type) {
        const typeMap = {
            'bed-covers': 'Bed Covers',
            'cushion-covers': 'Cushion Covers',
            'sarees': 'Sarees',
            'towels': 'Towels'
        };
        return typeMap[type] || type;
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('analyticsContent').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('analyticsContent').style.display = 'none';
    }

    showEmptyState() {
        document.getElementById('analyticsContent').style.display = 'block';
        document.getElementById('emptyState').style.display = 'block';
        document.querySelector('.row:has(#pieChart)').style.display = 'none';
    }

    showAnalyticsContent() {
        document.getElementById('analyticsContent').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        document.querySelector('.row:has(#pieChart)').style.display = 'flex';
    }
}

let analyticsDashboard;

// Initialize analytics dashboard with Chart.js check
function initializeDashboard() {
    console.log('Initializing analytics dashboard...');
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        showError('Chart.js library failed to load. Please refresh the page.');
        return;
    }
    
    console.log('Chart.js is available, creating dashboard...');
    
    try {
        analyticsDashboard = new AnalyticsDashboard();
        console.log('Analytics dashboard created successfully');
    } catch (error) {
        console.error('Error initializing analytics dashboard:', error);
        showError('Failed to initialize dashboard: ' + error.message);
    }
}

// Helper function to show error state
function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

// Wait for DOM to be ready and initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}
