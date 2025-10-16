# Design System Quick Reference Guide

## 🎨 Color Tokens

### Usage Guide
```css
/* Primary Colors - Use for main brand elements */
--color-primary: #1a1a2e          /* Headers, primary text */
--color-accent: #4a90e2           /* CTAs, links, highlights */

/* Status Colors - Use for feedback */
--color-success: #10b981          /* Success messages, positive metrics */
--color-warning: #f59e0b          /* Warnings, caution states */
--color-danger: #ef4444           /* Errors, destructive actions */
--color-info: #6366f1             /* Information, neutral feedback */

/* Neutral Colors - Use for UI elements */
--color-gray-50: #f9fafb          /* Backgrounds */
--color-gray-200: #e5e7eb         /* Borders, dividers */
--color-gray-500: #6b7280         /* Secondary text */
--color-gray-900: #111827         /* Primary text */
```

### Examples
```html
<!-- Primary Button -->
<button class="btn btn-primary">Add Product</button>

<!-- Success Alert -->
<div class="alert alert-success">Operation successful!</div>

<!-- Card with border -->
<div class="card" style="border-color: var(--color-gray-200)">
  ...
</div>
```

---

## 📝 Typography

### Font Families
```css
/* Display/Headings */
font-family: 'Instrument Serif', Georgia, serif;

/* Body/UI */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Font Scale
```html
<!-- Headlines -->
<h1>Hero Headline</h1>        <!-- 2.5rem - 4rem (fluid) -->
<h2>Section Header</h2>        <!-- 2rem - 3rem (fluid) -->
<h3>Subsection</h3>            <!-- 1.5rem - 2rem (fluid) -->

<!-- Body -->
<p class="text-lg">Large text</p>      <!-- 1.125rem - 1.25rem -->
<p>Regular text</p>                     <!-- 1rem - 1.125rem -->
<p class="text-sm">Small text</p>      <!-- 0.875rem - 1rem -->
```

### Font Weights
```css
font-weight: 400;  /* Normal - body text */
font-weight: 500;  /* Medium - emphasis */
font-weight: 600;  /* Semibold - headings, labels */
font-weight: 700;  /* Bold - strong emphasis */
```

---

## 📏 Spacing

### Spacing Scale
```html
<!-- Padding Examples -->
<div class="p-2">padding: 0.5rem</div>
<div class="p-4">padding: 1rem</div>
<div class="p-6">padding: 1.5rem</div>
<div class="p-8">padding: 2rem</div>

<!-- Margin Examples -->
<div class="mb-4">margin-bottom: 1rem</div>
<div class="mt-6">margin-top: 1.5rem</div>
<div class="my-8">margin-y: 2rem</div>
```

### Common Patterns
```css
/* Card Padding */
.card-body { padding: var(--spacing-6); }  /* 1.5rem / 24px */

/* Section Spacing */
.section { padding: var(--spacing-16) 0; }  /* 4rem / 64px */

/* Button Padding */
.btn { padding: var(--spacing-3) var(--spacing-5); }  /* 12px 20px */
```

---

## 🔘 Buttons

### Button Types
```html
<!-- Primary - Main actions -->
<button class="btn btn-primary">
  <i class="fas fa-plus me-2"></i>Add Product
</button>

<!-- Secondary - Alternative actions -->
<button class="btn btn-secondary">
  <i class="fas fa-boxes me-2"></i>View Inventory
</button>

<!-- Outline - Tertiary actions -->
<button class="btn btn-outline-primary">
  <i class="fas fa-external-link me-2"></i>Open Catalog
</button>

<!-- Sizes -->
<button class="btn btn-sm btn-primary">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-hero btn-primary">Hero</button>
```

### Button States
```css
/* Default State */
background: #4a90e2;
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Hover State */
background: #357abd;
transform: translateY(-1px);
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

/* Focus State */
outline: 2px solid #4a90e2;
outline-offset: 2px;

/* Disabled State */
opacity: 0.5;
cursor: not-allowed;
```

---

## 🃏 Cards

### Basic Card
```html
<div class="card">
  <div class="card-header">
    <h5><i class="fas fa-chart-line me-2"></i>Analytics</h5>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
</div>
```

### Card Styling
```css
/* Base */
background: white;
border: 1px solid #e5e7eb;
border-radius: 1rem;
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

/* Hover */
transform: translateY(-2px);
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

---

## 📋 Forms

### Form Elements
```html
<!-- Input Field -->
<div class="mb-3">
  <label for="productName" class="form-label">Product Name</label>
  <input type="text" class="form-control" id="productName" required>
  <div class="form-text">Enter a descriptive product name</div>
</div>

<!-- Select Dropdown -->
<div class="mb-3">
  <label for="productType" class="form-label">Product Type</label>
  <select class="form-select" id="productType" required>
    <option value="">Select Type</option>
    <option value="bed-covers">Bed Covers</option>
  </select>
</div>
```

### Form Validation
```html
<!-- Valid State -->
<input type="text" class="form-control is-valid">
<div class="valid-feedback">Looks good!</div>

<!-- Invalid State -->
<input type="text" class="form-control is-invalid">
<div class="invalid-feedback">Please provide a valid value</div>
```

---

## 🎭 Icons

### Font Awesome Usage
```html
<!-- With Text -->
<button class="btn btn-primary">
  <i class="fas fa-plus me-2" aria-hidden="true"></i>
  <span>Add Product</span>
</button>

<!-- Icon Only (requires aria-label) -->
<button class="btn btn-sm btn-primary" aria-label="Edit product">
  <i class="fas fa-edit" aria-hidden="true"></i>
</button>

<!-- Status Icons -->
<i class="fas fa-check-circle text-success"></i> Success
<i class="fas fa-exclamation-triangle text-warning"></i> Warning
<i class="fas fa-times-circle text-danger"></i> Error
<i class="fas fa-info-circle text-info"></i> Info
```

### Common Icons
```
fa-plus          - Add/Create
fa-edit          - Edit/Modify
fa-trash         - Delete/Remove
fa-search        - Search
fa-filter        - Filter
fa-download      - Download/Export
fa-upload        - Upload/Import
fa-chart-line    - Analytics
fa-boxes         - Inventory
fa-warehouse     - Store/Storage
```

---

## 🎨 Shadows & Elevation

### Shadow Scale
```css
/* Level 1 - Subtle (hover cards) */
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Level 2 - Standard (cards, buttons) */
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

/* Level 3 - Elevated (dropdowns) */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* Level 4 - High (modals) */
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

/* Level 5 - Maximum (overlays) */
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

---

## 🔄 Animations

### Transition Speeds
```css
/* Fast - Small state changes */
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Base - Standard interactions */
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);

/* Slow - Major changes */
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Common Animations
```html
<!-- Fade In -->
<div class="fade-in">Content appears</div>

<!-- Slide In -->
<div class="slide-in-right">Notification</div>

<!-- Hover Lift -->
<div class="card">Lifts on hover</div>
```

---

## 📱 Responsive Breakpoints

### Breakpoint Values
```css
/* Mobile First Approach */
/* Mobile: Base styles */
/* Tablet: 768px and up */
@media (min-width: 768px) { }

/* Desktop: 992px and up */
@media (min-width: 992px) { }

/* Large Desktop: 1200px and up */
@media (min-width: 1200px) { }

/* Max-width (desktop to mobile) */
@media (max-width: 767.98px) { }
@media (max-width: 991.98px) { }
```

### Responsive Patterns
```html
<!-- Grid - Auto-fit columns -->
<div class="hero-ctas">
  <!-- Auto-adjusts: 3 columns desktop, 1 column mobile -->
  <button>Action 1</button>
  <button>Action 2</button>
  <button>Action 3</button>
</div>

<!-- Utility Classes -->
<div class="d-none d-md-block">Hidden on mobile</div>
<div class="d-md-none">Shown only on mobile</div>
```

---

## ♿ Accessibility

### ARIA Labels
```html
<!-- Button with icon only -->
<button aria-label="Close dialog">
  <i class="fas fa-times" aria-hidden="true"></i>
</button>

<!-- Navigation -->
<nav aria-label="Main navigation">
  <ul>...</ul>
</nav>

<!-- Form Field -->
<input type="text" aria-describedby="nameHelp">
<small id="nameHelp">Enter your full name</small>
```

### Focus States
```css
/* Visible focus indicator */
button:focus-visible {
  outline: 2px solid #4a90e2;
  outline-offset: 2px;
}

/* Remove default */
button:focus {
  outline: none;
}
```

### Screen Reader Only Text
```html
<span class="visually-hidden">
  Additional context for screen readers
</span>
```

---

## 🎯 Common Patterns

### Page Header
```html
<nav class="navbar navbar-expand-lg" id="mainNav">
  <div class="container-fluid px-4">
    <a class="navbar-brand" href="#">Brand</a>
    <!-- Navigation items -->
  </div>
</nav>
```

### Hero Section
```html
<section class="hero-section">
  <div class="container">
    <div class="hero-content">
      <h1 class="hero-headline">Main Headline</h1>
      <p class="hero-subhead">Supporting text</p>
      <div class="hero-ctas">
        <button class="btn btn-hero btn-primary">Primary CTA</button>
        <button class="btn btn-hero btn-secondary">Secondary CTA</button>
      </div>
    </div>
  </div>
</section>
```

### Metric Cards
```html
<div class="profit-metrics">
  <div class="profit-card">
    <div class="profit-label">This Month</div>
    <div class="profit-value">$2,450</div>
    <div class="profit-change positive">+12.5%</div>
  </div>
</div>
```

### Modal Dialog
```html
<div class="modal fade" id="exampleModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Modal Title</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        Content here
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary">Save</button>
      </div>
    </div>
  </div>
</div>
```

---

## 🚦 Status Messages

### Alert Types
```html
<!-- Success -->
<div class="alert alert-success" role="alert">
  <i class="fas fa-check-circle me-2"></i>
  Operation completed successfully!
</div>

<!-- Warning -->
<div class="alert alert-warning" role="alert">
  <i class="fas fa-exclamation-triangle me-2"></i>
  Please review before proceeding.
</div>

<!-- Error -->
<div class="alert alert-danger" role="alert">
  <i class="fas fa-times-circle me-2"></i>
  An error occurred. Please try again.
</div>

<!-- Info -->
<div class="alert alert-info" role="alert">
  <i class="fas fa-info-circle me-2"></i>
  Additional information available.
</div>
```

---

## 📐 Layout Grid

### Container
```html
<!-- Fluid Container -->
<div class="container-fluid px-4">
  Content spans full width with padding
</div>

<!-- Fixed Container -->
<div class="container">
  Content centered with max-width
</div>
```

### Grid System
```html
<!-- 2-Column Layout -->
<div class="row">
  <div class="col-md-6">Column 1</div>
  <div class="col-md-6">Column 2</div>
</div>

<!-- Responsive Columns -->
<div class="row">
  <div class="col-12 col-md-6 col-lg-4">
    <!-- Full width mobile, half tablet, third desktop -->
  </div>
</div>
```

---

## 🎨 CSS Custom Properties Reference

### How to Use
```css
/* In your CSS */
.my-element {
  color: var(--color-primary);
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

/* Override in component */
.special-card {
  --card-bg: var(--color-accent-light);
  background: var(--card-bg);
}
```

### Available Tokens
- Colors: `--color-*`
- Spacing: `--spacing-*`
- Font sizes: `--font-size-*`
- Border radius: `--radius-*`
- Shadows: `--shadow-*`
- Transitions: `--transition-*`
- Z-index: `--z-index-*`

---

## 📖 Best Practices

### DO ✅
- Use design tokens (CSS variables) for consistency
- Include ARIA labels for accessibility
- Use semantic HTML elements
- Provide keyboard navigation support
- Test on multiple screen sizes
- Use meaningful class names
- Include focus states
- Optimize images
- Use system fonts fallbacks

### DON'T ❌
- Hard-code colors or spacing values
- Use icon-only buttons without labels
- Rely solely on color for information
- Create hover-only interactions on mobile
- Skip focus indicators
- Use generic names like "div1", "box"
- Forget alt text on images
- Use tiny touch targets (<44px)

---

## 🔗 Quick Links

- [Full UX Documentation](./UX_DESIGN_IMPROVEMENTS.md)
- [Font Awesome Icons](https://fontawesome.com/icons)
- [Bootstrap Docs](https://getbootstrap.com/docs/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Version:** 2.0.0  
**Last Updated:** October 16, 2025

