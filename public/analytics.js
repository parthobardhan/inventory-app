
class AnalyticsDashboard {
    constructor() {
        this.apiBase = '/api/products';
        this.pieChart = null;
        this.barChart = null;
        this.colors = {
            'bed-covers': '#0d6efd',      // Bootstrap primary blue
            'cushion-covers': '#198754',   // Bootstrap success green
            'sarees': '#6f42c1',          // Bootstrap purple
            'napkins': '#fd7e14',         // Bootstrap orange
            'towels': '#dc3545'           // Bootstrap danger red
        };
        this.init();
    }

    async init() {
        try {
            await this.loadAnalyticsData();
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

    updateMetrics(data) {
        document.getElementById('totalProductsMetric').textContent = data.totalProducts.toLocaleString();
        document.getElementById('totalValueMetric').textContent = `$${data.totalValue.toFixed(2)}`;
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

    formatProductType(type) {
        const typeMap = {
            'bed-covers': 'Bed Covers',
            'cushion-covers': 'Cushion Covers',
            'sarees': 'Sarees',
            'napkins': 'Napkins',
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
document.addEventListener('DOMContentLoaded', () => {
    analyticsDashboard = new AnalyticsDashboard();
});
