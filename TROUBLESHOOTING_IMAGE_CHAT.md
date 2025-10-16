# Troubleshooting AI Chat Image Upload

## Changes Made to Fix 400 Error

### 1. Enhanced Error Handling
- Added detailed logging on both frontend and backend
- Added Multer error handler for file upload issues
- Better error messages shown to user

### 2. Frontend Improvements
- Always sends a message with image (default if user doesn't type)
- Logs request details to console
- Shows actual error messages from server

### 3. Backend Improvements
- Logs all incoming requests with details
- Normalizes empty messages
- Catches Multer errors before they reach route handler

## How to Debug

### Step 1: Open Browser Console
1. Open the app in your browser
2. Press F12 to open Developer Tools
3. Go to the Console tab

### Step 2: Try Uploading an Image
1. Click the AI chat button
2. Click the image upload icon (📷)
3. Select an image
4. Type a message like: "Add 20 bed covers for $25"
5. Click send

### Step 3: Check Console Output

**Frontend logs should show:**
```
📤 Sending chat with image: {
  messageLength: 26,
  imageSize: 123456,
  imageName: "product.jpg"
}
📥 Response status: 200
```

**Backend logs should show:**
```
📥 Received chat request: {
  hasMessage: true,
  messageLength: 26,
  hasImage: true,
  bodyKeys: ['message', 'conversationHistory']
}
Image received: product.jpg 123456 bytes
🖼️  Processing chat request with image...
```

### Common Errors and Solutions

#### Error: "File too large"
- **Cause**: Image exceeds 10MB
- **Solution**: Resize or compress the image

#### Error: "Only image files are allowed"
- **Cause**: Wrong file type selected
- **Solution**: Select a valid image file (JPG, PNG, GIF, WebP)

#### Error: "Message or image is required"
- **Cause**: Neither message nor image was sent
- **Solution**: This shouldn't happen anymore - check browser console

#### Error: "OpenAI API key not configured"
- **Cause**: Missing or invalid OpenAI API key
- **Solution**: Check your `.env` file has valid `OPENAI_API_KEY`

#### Error: "Database connection not available"
- **Cause**: MongoDB connection failed
- **Solution**: Check `MONGODB_URI` in `.env` file

## Testing Checklist

- [ ] Can upload image and see preview
- [ ] Can remove image before sending
- [ ] Can send image with message
- [ ] Can send image without message (uses default)
- [ ] Image appears in chat history
- [ ] AI responds with product details
- [ ] Product is created in database
- [ ] Console shows detailed logs
- [ ] Error messages are clear and helpful

## What the Flow Should Look Like

1. **User uploads image** → Preview shows
2. **User types message** → "Add 20 bed covers for $25"
3. **User clicks send** → 
   - Frontend sends FormData with image + message
   - Backend receives and validates
   - OpenAI vision analyzes image
   - AI identifies product type, colors, patterns
   - AI calls `add_product` tool
   - Product is created with details from image + message
   - Success response sent back
4. **User sees confirmation** → "Successfully added 20 bed covers..."

## Note on Image Storage

**Important**: Currently, the image is used for AI analysis but NOT stored with the product.

If you want the image to be stored (like in Add Product modal), we need to:
1. Upload image to S3 first
2. Get the S3 URL
3. Pass that URL to the AI
4. Include the image URL when creating the product

Let me know if you want this enhancement!

## Next Steps

1. Try uploading an image with the improvements
2. Check the console logs (both frontend and backend)
3. Share the exact error message you see
4. I can then provide a specific fix

