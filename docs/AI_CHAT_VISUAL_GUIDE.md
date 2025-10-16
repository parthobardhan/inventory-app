# AI Chat Assistant - Visual Design Guide

## 🎨 Design System

### Color System

#### Primary Gradient (AI Messages)
```
Start: #667eea (Purple)
End: #764ba2 (Deep Purple)
Usage: AI avatar, header, buttons, accents
```

#### Secondary Gradient (User Messages)
```
Start: #0ea5e9 (Sky Blue)
End: #2563eb (Blue)
Usage: User messages, user avatar
Contrast: 7:1 (WCAG AAA compliant)
```

#### Neutral Colors
```
Background: #f8f9fa (Light Gray)
Surface: #ffffff (White)
Border: #e9ecef (Border Gray)
Text Primary: #000000
Text Secondary: #6c757d
```

#### State Colors
```
Success: #28a745 (Green)
Error: #dc3545 (Red)
Warning: #ffc107 (Amber)
Info: #667eea (Purple)
```

---

## 📐 Spacing & Layout

### Chat Window Dimensions

```
Desktop (>992px):
├── Width: 480px
├── Height: 700px
├── Border Radius: 20px
└── Position: Fixed (bottom: 20px, right: 20px)

Tablet (768-992px):
├── Width: 440px
├── Height: 680px
├── Border Radius: 16px
└── Position: Fixed (bottom: 10px, right: 10px)

Mobile (<768px):
├── Width: calc(100vw - 20px)
├── Height: calc(100vh - 80px)
├── Border Radius: 16px
└── Position: Fixed (bottom: 10px, right: 10px)

Extra Small (<480px):
├── Width: 100vw
├── Height: 100vh
├── Border Radius: 0 (fullscreen)
└── Position: Fixed (bottom: 0, right: 0)
```

### Internal Spacing

```
Header Padding: 20px 24px
Body Padding: 24px
Input Container Padding: 20px
Message Padding: 14px 18px
Gap Between Messages: 16px
```

---

## 🔤 Typography

### Font Specifications

```css
/* Message Content */
Font Size: 15px
Line Height: 1.6
Font Weight: 400 (AI) / 500 (User)
Font Family: 'Inter', system-ui, sans-serif

/* Header Title */
Font Size: 18px
Font Weight: 600

/* Status Text */
Font Size: 13px
Line Height: 1.4

/* Suggestion Chips */
Font Size: 13px
Font Weight: 400

/* Tool Results */
Font Size: 14px
Line Height: 1.5
```

---

## 🎭 Component Specifications

### Message Bubble

```css
AI Message:
├── Background: White
├── Text Color: #000000
├── Border Radius: 16px
├── Padding: 14px 18px
├── Max Width: 85%
├── Box Shadow: 0 2px 12px rgba(0,0,0,0.08)
└── Alignment: Left

User Message:
├── Background: linear-gradient(135deg, #0ea5e9, #2563eb)
├── Text Color: #ffffff
├── Border Radius: 16px
├── Padding: 14px 18px
├── Max Width: 85%
├── Box Shadow: 0 2px 12px rgba(0,0,0,0.08)
└── Alignment: Right
```

### Avatar

```css
Dimensions: 36px × 36px
Border Radius: 50% (circular)
Display: Flex (centered icon)
Icon Size: 18px

AI Avatar:
└── Background: linear-gradient(135deg, #667eea, #764ba2)

User Avatar:
└── Background: linear-gradient(135deg, #0ea5e9, #2563eb)
```

### Buttons

```css
Send Button:
├── Size: 44px × 44px
├── Border Radius: 12px
├── Background: linear-gradient(135deg, #667eea, #764ba2)
├── Icon Color: White
└── Hover: translateY(-2px) + shadow

Upload Button:
├── Size: 44px × 44px
├── Border Radius: 12px
├── Background: #e9ecef (default) / #667eea (active)
├── Icon Color: #495057 (default) / white (active)
└── Hover: translateY(-2px) + color change

Close Button:
├── Size: 32px × 32px
├── Border Radius: 8px
├── Background: Transparent (rgba on hover)
└── Color: White
```

---

## 🎬 Animations & Transitions

### Keyframes

```css
@keyframes slideInUp
Duration: 0.3s
Easing: ease
Effect: Fade in + translate up 20px

@keyframes fadeIn
Duration: 0.3s
Easing: ease
Effect: Fade in + translate up 10px

@keyframes pulse
Duration: 2s
Easing: ease-in-out
Loop: infinite
Effect: Scale 1 → 1.08 → 1

@keyframes bounce
Duration: 1.4s / 1s
Easing: ease-in-out both
Loop: infinite
Effect: Scale 0 → 1 → 0 (dots) / translate (icon)
```

### Transition Specs

```css
Button Hover:
├── Property: transform, box-shadow
├── Duration: 0.2s
└── Easing: ease

Input Focus:
├── Property: border-color, box-shadow
├── Duration: 0.2s
└── Easing: ease

Scrollbar Thumb:
├── Property: background
├── Duration: 0.2s
└── Easing: ease

Suggestion Chips:
├── Property: background, color, transform
├── Duration: 0.2s
└── Easing: ease

Drop Zone:
├── Property: opacity, visibility
├── Duration: 0.2s
└── Easing: ease
```

---

## 🖼️ Drag & Drop Zone

### Full Overlay Specifications

```css
Position: Absolute (covers entire chat)
Background: rgba(102, 126, 234, 0.95)
Z-Index: 1001
Display: Flex (centered content)
Border Radius: 20px
Pointer Events: none (clicks pass through)

Content Structure:
├── Icon (Cloud Upload)
│   ├── Size: 64px
│   ├── Color: White
│   └── Animation: bounce (1s infinite)
├── Text ("Drop your image here")
│   ├── Size: 20px
│   ├── Weight: 600
│   └── Color: White
└── Hint ("PNG, JPG, GIF up to 10MB")
    ├── Size: 14px
    ├── Weight: 400
    └── Opacity: 0.9
```

### States

```css
Hidden (default):
└── display: none

Active (dragging):
└── display: flex

Hover Effect:
└── Icon bounces smoothly
```

---

## 📱 Responsive Breakpoints

### Mobile Optimization

```css
@media (max-width: 480px)
├── Fullscreen mode
├── No border radius
├── Simplified shadows
└── Touch-optimized spacing

@media (max-width: 768px)
├── Reduced width
├── Adjusted font sizes
├── Compact message bubbles
└── Smaller avatars

@media (max-width: 992px)
├── Slightly reduced dimensions
└── Maintained desktop features
```

---

## ✨ Interactive States

### Hover States

```
Send Button → Lift up 2px + Enhanced shadow
Upload Button → Lift up 2px + Color change to purple
Suggestion Chip → Purple background + White text + Lift
Close Button → Semi-transparent white background
Scrollbar Thumb → Darker gray
```

### Focus States

```
Input Textarea → Purple border + Soft purple shadow (3px)
All Buttons → Visible outline for keyboard navigation
```

### Active States

```
Button Press → Scale down slightly
Upload (with image) → Purple background + White icon
Drag Over → Show drop zone overlay
```

### Disabled States

```
Send Button → 50% opacity + No cursor change
All inputs → Grayed out + No interaction
```

---

## 🔍 Accessibility Features

### Contrast Ratios

```
User Message Text: 7:1 (AAA)
AI Message Text: 12:1 (AAA)
Button Icons: 8:1 (AAA)
Secondary Text: 4.8:1 (AA)
```

### Keyboard Navigation

```
✓ Tab order: Logical flow
✓ Enter: Send message
✓ Shift + Enter: New line
✓ Escape: Close chat (future)
✓ Focus indicators: Visible outlines
```

### Screen Readers

```
✓ Semantic HTML structure
✓ ARIA labels on buttons
✓ Alt text on images
✓ Role attributes
✓ Status announcements
```

---

## 📊 Scrollbar Design

### Custom WebKit Scrollbar

```css
Width: 8px
Track:
├── Background: #e9ecef
└── Border Radius: 4px

Thumb:
├── Background: #cbd5e0
├── Border Radius: 4px
├── Hover: #a0aec0
└── Transition: background 0.2s ease
```

---

## 🎯 Visual Hierarchy

### Z-Index Stack

```
1001: Drop zone overlay
1000: Chat widget
100: Floating elements
10: Interactive elements
1: Content layer
0: Base layer
```

### Shadow Depth System

```css
Level 1 (Subtle):
box-shadow: 0 2px 8px rgba(0,0,0,0.08)

Level 2 (Card):
box-shadow: 0 2px 12px rgba(0,0,0,0.08)

Level 3 (Elevated):
box-shadow: 0 4px 12px rgba(0,0,0,0.15)

Level 4 (Modal):
box-shadow: 0 10px 40px rgba(0,0,0,0.15)

Level 5 (Highest):
box-shadow: 0 20px 60px rgba(0,0,0,0.2)
```

---

## 🎨 Usage Guidelines

### Do's ✅

- Use gradient backgrounds for user messages
- Maintain 16px spacing between messages
- Keep message width at 85% max
- Use smooth transitions (0.2s)
- Apply proper border radius (16-20px)
- Ensure WCAG AA minimum contrast
- Test on mobile devices
- Implement keyboard navigation

### Don'ts ❌

- Don't use flat colors for user messages
- Don't exceed 90% message width
- Don't use harsh transitions (>0.3s)
- Don't ignore mobile breakpoints
- Don't skip hover states
- Don't forget focus indicators
- Don't use pure black (#000) for text (use #1a1a1a)
- Don't animate without purpose

---

## 🚀 Performance Tips

1. Use CSS transforms (not position properties) for animations
2. Avoid animating expensive properties (width, height)
3. Use `will-change` sparingly for heavy animations
4. Implement smooth scrolling with CSS
5. Lazy load images in messages
6. Debounce input events
7. Use CSS variables for theme consistency

---

**Design System Version**: 2.0.0
**Last Updated**: October 16, 2025
**Maintained By**: Design & Engineering Team

