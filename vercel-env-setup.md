# Vercel Environment Variables Setup

## Required Environment Variables for Production

To fix the S3 upload and AI caption generation issues in Vercel, you need to set these environment variables in your Vercel project:

### 1. Go to Vercel Dashboard
1. Visit [vercel.com](https://vercel.com)
2. Go to your project dashboard
3. Click on "Settings" tab
4. Click on "Environment Variables" in the left sidebar

### 2. Add These Environment Variables

#### AI Service Configuration
```
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here
```
- **Required for AI caption generation in production**
- Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- Make sure it starts with `sk-proj-` or `sk-`

#### Database Configuration
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```
- Your MongoDB Atlas connection string
- Replace `username`, `password`, `cluster`, and `database` with your actual values

#### AWS S3 Configuration
```
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```
- Required for image upload to S3
- Get these from your AWS IAM user credentials
- Make sure the IAM user has S3 permissions

#### Environment Configuration
```
NODE_ENV=production
```
- This tells the app to use OpenAI instead of Ollama for AI generation

### 3. Environment Variable Settings

For each environment variable:
- **Name**: The variable name (e.g., `OPENAI_API_KEY`)
- **Value**: The actual value (e.g., your API key)
- **Environment**: Select "Production" (and optionally "Preview" and "Development")

### 4. Redeploy

After adding all environment variables:
1. Go to the "Deployments" tab
2. Click "Redeploy" on the latest deployment
3. Or push a new commit to trigger a new deployment

## Verification

After deployment, you can verify the setup by:

1. **Check the logs** in Vercel dashboard for these messages:
   - `🚀 PRODUCTION MODE: Using OpenAI for production deployment`
   - `✅ Successfully uploaded to S3: ...`
   - `✅ AI GENERATION COMPLETED!`

2. **Test the functionality**:
   - Add a product with an image through the homepage
   - Check that the image appears in your S3 bucket
   - Verify that AI-generated captions are created

## Common Issues

### Issue: "AI service unavailable - please try again later"
**Solution**: Check that `OPENAI_API_KEY` is set correctly and has sufficient credits

### Issue: "S3 upload failed"
**Solution**: Verify AWS credentials and S3 bucket permissions

### Issue: "Database connection not available"
**Solution**: Check `MONGODB_URI` format and network access

### Issue: Still using Ollama in production
**Solution**: Ensure `NODE_ENV=production` is set in Vercel environment variables

## Testing Locally with Production Settings

To test with production settings locally:

1. Create a `.env.local` file:
```bash
NODE_ENV=production
OPENAI_API_KEY=sk-proj-your-openai-api-key
MONGODB_URI=your-mongodb-uri
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

2. Restart your development server:
```bash
npm start
```

3. Test the upload functionality - it should now use OpenAI instead of Ollama
