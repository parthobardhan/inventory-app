# Production Deployment Guide

## AI Service Configuration

This application supports two AI service modes:

### Development Mode (Local)
- **Service**: Ollama with LLaVA models
- **Environment**: `NODE_ENV=development`
- **Requirements**: Local Ollama installation with LLaVA model
- **Usage**: Automatic fallback when OpenAI is not configured

### Production Mode (Cloud)
- **Service**: OpenAI GPT-4o-mini
- **Environment**: `NODE_ENV=production`
- **Requirements**: Valid OpenAI API key
- **Usage**: Primary service for production deployments

## Environment Configuration

### Required Environment Variables

#### For Production Deployment:
```bash
# AI Service Configuration
OPENAI_API_KEY=your-openai-api-key-here
NODE_ENV=production

# Database Configuration
MONGODB_URI=your-mongodb-connection-string

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# Server Configuration
PORT=3000
```

#### For Development:
```bash
# AI Service Configuration (Optional - uses Ollama if not provided)
OPENAI_API_KEY=your-openai-api-key-here
NODE_ENV=development

# Other configurations same as production
```

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
- Copy `dev.env.example` to `dev.env` or set environment variables
- Set `NODE_ENV=production` for production deployment
- Configure `OPENAI_API_KEY` with your OpenAI API key

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Option B: Using Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `MONGODB_URI`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `S3_BUCKET_NAME`
   - `NODE_ENV=production`

### 4. Environment Variables in Vercel
Set these in your Vercel project settings:

```
OPENAI_API_KEY=sk-proj-your-openai-api-key
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
NODE_ENV=production
```

## AI Service Behavior

### Automatic Service Selection
The application automatically selects the AI service based on:
1. **Environment**: `NODE_ENV=production` → OpenAI
2. **API Key**: Valid `OPENAI_API_KEY` → OpenAI
3. **Fallback**: Development mode → Ollama

### Service Comparison

| Feature | OpenAI GPT-4o-mini | Ollama LLaVA |
|---------|-------------------|--------------|
| **Environment** | Production | Development |
| **Speed** | Fast | Slower |
| **Accuracy** | High | Good |
| **Cost** | Pay per use | Free |
| **Internet** | Required | Not required |
| **Setup** | API key only | Local installation |

## Testing

### Test AI Services

#### Automatic Service Selection
```bash
# Test with automatic service selection (default behavior)
npm run test:ai
```

#### Force OpenAI Mode (Local Testing)
```bash
# Test OpenAI in local development environment
npm run test:ai:openai

# Alternative: Force OpenAI mode with general test
npm run test:ai:force
```

#### Interactive CLI Testing
```bash
# CLI with different modes
npm run test:ai:cli                    # Auto mode
npm run test:ai:cli openai             # Force OpenAI
npm run test:ai:cli ollama             # Force Ollama
npm run test:ai:cli both               # Test both services
npm run test:ai:cli openai ~/Downloads/bedcover.jpg  # Custom image

# Show help
node test-ai-cli.js --help
```

#### Test with Local Images
```bash
# Test with your bedcover image
node test-ai-cli.js openai ~/Downloads/bedcover.jpg
```

## API Usage

### Image Analysis Endpoint
```bash
POST /api/images/upload/:productId
Content-Type: multipart/form-data

# Form data:
- image: [image file]
- generateAI: true
```

### Response Format
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageId": "uuid",
    "url": "https://s3.amazonaws.com/bucket/image.jpg",
    "aiGenerated": {
      "title": "Product Title",
      "description": "Product Description",
      "confidence": 0.9,
      "model": "OpenAI GPT-4o-mini",
      "generatedAt": "2024-01-01T00:00:00.000Z",
      "rawCaption": "Raw AI caption"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. OpenAI API Key Issues
```
Error: OpenAI API key not configured
Solution: Set OPENAI_API_KEY environment variable
```

#### 2. Image Processing Errors
```
Error: Image download failed
Solution: Check image URL accessibility and network connectivity
```

#### 3. Service Selection Issues
```
Error: No AI service available
Solution: Ensure either OpenAI API key or Ollama is properly configured
```

### Debug Mode
Set `NODE_ENV=development` to enable detailed logging and fallback to Ollama.

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use secure environment variable management
3. **Rate Limiting**: Configure appropriate rate limits for production
4. **CORS**: Configure CORS settings for your domain
5. **HTTPS**: Always use HTTPS in production

## Performance Optimization

1. **Image Compression**: Images are automatically compressed before processing
2. **Caching**: Implement caching for frequently accessed images
3. **CDN**: Use CDN for static assets
4. **Database Indexing**: Ensure proper database indexes for queries

## Monitoring

### Health Check Endpoint
```bash
GET /api/health
```

### Logs
Monitor application logs for:
- AI service selection
- Image processing times
- Error rates
- API usage

## Cost Management

### OpenAI Usage
- Monitor API usage in OpenAI dashboard
- Set usage limits and alerts
- Consider implementing request caching
- Use appropriate image sizes to minimize costs

### AWS S3 Costs
- Monitor storage usage
- Implement lifecycle policies
- Use appropriate storage classes
- Monitor data transfer costs
