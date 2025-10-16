# AI Chat Image Upload Feature

## Overview
The AI chat now supports image uploads, allowing you to add products by uploading an image and describing what you want to do with it. This follows the same intuitive flow as the "Add Product" modal.

## Features Implemented

### 1. Frontend (UI/UX)
- **Image Upload Button**: A dedicated image icon button in the chat input area
- **Image Preview**: Shows a preview of the uploaded image before sending
- **Remove Image**: Option to remove the selected image before sending
- **Visual Feedback**: The upload button changes color when an image is selected
- **Responsive Design**: Works seamlessly on both desktop and mobile devices

### 2. Frontend (JavaScript)
- **File Validation**: 
  - Only image files are accepted
  - Maximum file size: 10MB
  - Shows error messages for invalid files
- **Image Handling**:
  - Previews images before sending
  - Sends images as multipart/form-data
  - Displays images in the chat history
  - Clears image after sending

### 3. Backend API
- **Enhanced `/api/agent/chat` endpoint**:
  - Accepts both JSON (text-only) and multipart/form-data (with images)
  - Uses Multer middleware for handling file uploads
  - Validates image files server-side
  - Routes to appropriate handler based on presence of image

### 4. AI Integration
- **Vision-Powered Analysis**:
  - Uses OpenAI's GPT-4o-mini with vision capabilities
  - Analyzes product images to identify type, colors, patterns, materials
  - Combines visual analysis with user's text message
  - Automatically calls appropriate tools (e.g., `add_product`)

## Usage Examples

### Example 1: Add Product with Image
1. Click the image icon button in the AI chat
2. Select a product image (e.g., a blue cushion cover)
3. Type: "Add 20 of these for $35 each"
4. Press send

**What happens:**
- AI analyzes the image and identifies it as a cushion cover
- Extracts visual details (colors, patterns)
- Combines with your message (quantity: 20, price: $35)
- Calls `add_product` tool automatically
- Responds with confirmation

### Example 2: Identify Product Type
1. Upload an image
2. Type: "What type of product is this?"
3. Press send

**What happens:**
- AI analyzes the image
- Identifies the product category
- Provides detailed description

### Example 3: Add Product with Custom Details
1. Upload an image of a bed cover
2. Type: "Add this as 'Premium Cotton Bed Cover' with SKU BED-123, 50 units at $45 each"
3. Press send

**What happens:**
- AI uses provided name and SKU
- Analyzes image for description
- Creates product with all details

## Technical Architecture

### Data Flow
```
User uploads image + types message
    ↓
Frontend (ai-agent.js)
    ↓ FormData with image file
Backend API (/api/agent/chat)
    ↓ Multer processes image
Agent Service (chatWithImage)
    ↓ Converts to base64
OpenAI GPT-4o-mini Vision
    ↓ Analyzes image + message
Tool Execution (add_product, etc.)
    ↓
Response to user
```

### Key Files Modified

1. **`/public/index.html`**
   - Added image upload button
   - Added image preview area
   - Added file input element

2. **`/public/css/ai-chat.css`**
   - Styled upload button
   - Styled image preview
   - Added responsive design

3. **`/public/js/ai-agent.js`**
   - Added image selection handler
   - Modified sendMessage to support images
   - Added image preview logic
   - Added clear image functionality

4. **`/routes/agent.js`**
   - Added Multer middleware for file uploads
   - Modified POST /api/agent/chat to handle both JSON and multipart
   - Added image file validation

5. **`/services/agentService.js`**
   - Added `chatWithImage` function
   - Integrated OpenAI vision capabilities
   - Enhanced system prompt for image analysis
   - Added image-to-base64 conversion

## Benefits

1. **Natural Workflow**: Matches the existing "Add Product" modal workflow
2. **AI-Powered**: Automatically extracts product details from images
3. **Flexible**: Works with or without text descriptions
4. **User-Friendly**: Simple drag-and-drop or click-to-upload interface
5. **Intelligent**: AI understands product types and attributes from images

## Limitations & Considerations

1. **File Size**: Maximum 10MB per image
2. **API Costs**: Vision API calls cost more than text-only
3. **Accuracy**: AI might occasionally misidentify products - users can correct
4. **Internet Required**: Requires connection to OpenAI API

## Future Enhancements

Potential improvements for future versions:
- Support for multiple images at once
- Image cropping/editing before sending
- Save image analysis results for reference
- Bulk product addition from multiple images
- Direct integration with S3 for image storage
- Support for product image updates

## Testing

To test the feature:
1. Start the application
2. Open the AI chat
3. Click the image icon (📷)
4. Select a product image
5. Type a message like "Add 10 of these for $25"
6. Verify the product is created with correct details

## Support

If you encounter issues:
- Check browser console for errors
- Verify OpenAI API key is configured
- Ensure image is under 10MB
- Check that image format is supported (JPEG, PNG, GIF, WebP)

