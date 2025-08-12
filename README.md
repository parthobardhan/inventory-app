# Inventory Management System

A modern web-based inventory management system specifically designed for textile products including bed covers, cushion covers, napkins, and towels.

## Features

- **Product Management**: Add, edit, and delete textile products
- **Inventory Tracking**: Monitor quantities and stock levels
- **Search & Filter**: Find products by name, description, or type
- **Real-time Summary**: View total products, inventory value, and type breakdown
- **Data Persistence**: All data is saved locally in browser storage
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Clean, intuitive interface with Bootstrap 5

## Product Types Supported

- Bed Covers
- Cushion Covers
- Napkins
- Towels

## Getting Started

1. Open `index.html` in your web browser
2. Start adding products using the form on the left
3. View and manage your inventory in the table on the right
4. Use search and filter options to find specific products

## Usage

### Adding Products
1. Fill in the product details in the "Add New Product" form
2. Select the appropriate product type from the dropdown
3. Enter quantity, price, and optional description
4. Click "Add Product" to save

### Managing Products
- **Edit**: Click the edit (pencil) icon to modify product details
- **Delete**: Click the delete (trash) icon to remove a product
- **Search**: Use the search box to find products by name or description
- **Filter**: Use the type dropdown to filter by product category

### Inventory Summary
The left sidebar shows:
- Total number of products in inventory
- Total monetary value of inventory
- Breakdown by product type with quantities and values

## Technical Details

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6
- **Data Storage**: Browser localStorage
- **No Backend Required**: Runs entirely in the browser

## File Structure

```
textile-inventory-app/
├── index.html          # Main application page
├── styles.css          # Custom styling
├── script.js           # Application logic
└── README.md           # This file
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Data Export/Import

The application stores data locally in your browser. To backup or transfer data:
1. Data is automatically saved to localStorage
2. Future versions will include export/import functionality

## Contributing

This is a standalone application. To modify or extend:
1. Edit the HTML structure in `index.html`
2. Update styling in `styles.css`
3. Modify functionality in `script.js`

## License

This project is open source and available under the MIT License.
