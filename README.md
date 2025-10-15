# 📱 Textile Inventory Manager PWA

A comprehensive Progressive Web App (PWA) for managing textile inventory with offline capabilities, AI-powered product descriptions, and modern web technologies.

## 🚀 Live Demo

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/textile-inventory-pwa)

## ✨ Features

### 📱 Progressive Web App
- **Installable** on any device (mobile, tablet, desktop)
- **Offline functionality** with IndexedDB storage
- **Service Worker** for caching and background sync
- **Push notifications** ready (for low inventory alerts)
- **App-like experience** with custom icons and splash screens

### 🏭 Inventory Management
- **Product CRUD operations** (Create, Read, Update, Delete)
- **Real-time search and filtering** by name, type, or description
- **Multiple product types** (bed covers, cushion covers, sarees, towels)
- **Inventory analytics** with charts and summaries
- **Image upload** with AI-powered descriptions

### 🤖 AI Integration
- **AI Agent Assistant** 🆕: Natural language interface for inventory management
  - Talk to your inventory using plain English
  - Add products, record sales, view analytics with simple commands
  - Powered by GPT-4o-mini with function calling
  - Example: "Add 50 blue bed covers for $25" or "Show me this week's sales"
- **Dual AI Service Support**: OpenAI GPT-4o-mini (production) and Ollama LLaVA (development)
- **Automatic product descriptions** using advanced vision-language models
- **Image analysis** for product categorization and description generation
- **Smart title generation** from product images
- **Confidence scoring** for AI-generated content
- **Environment-aware service selection** (production vs development)

### 📊 Analytics Dashboard
- **Interactive charts** showing inventory distribution
- **Value calculations** and stock summaries
- **Type-based breakdowns** with visual representations
- **Real-time updates** as inventory changes

### 🌐 Modern Web Technologies
- **Node.js/Express** backend with RESTful API
- **MongoDB** for data persistence
- **IndexedDB** for offline storage
- **Bootstrap 5** for responsive UI
- **Chart.js** for data visualization
- **Font Awesome** for icons

## 🛠 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Multer** - File upload handling
- **Sharp** - Image processing

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Bootstrap 5** - CSS framework
- **Chart.js** - Data visualization
- **Font Awesome** - Icon library
- **Service Worker** - PWA functionality
- **IndexedDB** - Client-side storage

### AI & Cloud Services
- **Hugging Face** - AI model inference
- **AWS S3** - Image storage (optional)
- **Ollama** - Local AI models (optional)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Git
- OpenAI API key (for production) or Ollama (for development)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/textile-inventory-pwa.git
   cd textile-inventory-pwa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp dev.env.example dev.env
   # Edit dev.env with your configuration
   ```

4. **AI Service Setup**
   
   **For Development (Local):**
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Pull LLaVA model
   ollama pull llava:7b
   ```

   **For Production:**
   ```bash
   # Set OpenAI API key in dev.env
   OPENAI_API_KEY=your-openai-api-key-here
   NODE_ENV=production
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🤖 AI Agent Setup (New Feature!)

The inventory app now includes an **AI Assistant** that understands natural language commands!

### Quick Setup

1. **Get an OpenAI API key** from [platform.openai.com](https://platform.openai.com)
2. **Add to your `dev.env` file:**
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. **Restart the server** and look for the purple "AI Assistant" banner on the homepage
4. **Click "Start Chat"** and start talking to your inventory!

### Example Commands

- "Add 50 blue cotton bed covers for $25"
- "Show me this week's sales analytics"
- "What products are low in stock?"
- "Record a sale of 10 towels"
- "Open the bed covers catalog"

📖 **For detailed setup and usage guide, see [AI_AGENT_SETUP.md](./AI_AGENT_SETUP.md)**

### 🚀 Production Deployment

For production deployment with OpenAI GPT-4o-mini, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed instructions.

### 🧪 Testing AI Services

#### Quick Tests
```bash
# Test automatic service selection
npm run test:ai

# Test OpenAI in local development
npm run test:ai:openai

# Interactive CLI testing
npm run test:ai:cli openai ~/Downloads/bedcover.jpg
```

#### Available Test Commands
- `npm run test:ai` - Test with automatic service selection
- `npm run test:ai:openai` - Force OpenAI mode for local testing
- `npm run test:ai:force` - Alternative OpenAI force mode
- `npm run test:ai:cli` - Interactive CLI with multiple options

### Environment Variables

Create a `dev.env` file with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/textile-inventory

# Server
PORT=3000
NODE_ENV=development

# AI Services (Optional)
HUGGINGFACE_API_KEY=your_huggingface_api_key

# OpenAI Configuration (for production deployment)
OPENAI_API_KEY=your_openai_api_key_here

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name
```

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables
   - Deploy!

3. **Set Environment Variables in Vercel**
   - `MONGODB_URI` - Your MongoDB connection string
   - `NODE_ENV` - Set to "production"
   - Add any other required environment variables

### Deploy to Other Platforms

The app is also compatible with:
- **Heroku** - Add `Procfile` with `web: node server.js`
- **Railway** - Works out of the box
- **DigitalOcean App Platform** - Use the included configuration
- **AWS Elastic Beanstalk** - Node.js platform

## 📱 PWA Features

### Installation
- **Desktop**: Install button appears in supported browsers
- **Mobile**: "Add to Home Screen" option available
- **Automatic**: Meets all PWA installation criteria

### Offline Functionality
- **View products** cached in IndexedDB
- **Add/edit products** queued for sync when online
- **Search and filter** works offline
- **Analytics dashboard** available offline

### Performance
- **Fast loading** with service worker caching
- **Background sync** for offline operations
- **Push notifications** ready for implementation
- **App-like navigation** when installed

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

## 📊 API Endpoints

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Images
- `POST /api/images/upload/:productId` - Upload product image
- `GET /api/images/:productId` - Get product image

### Health
- `GET /api/health` - Health check endpoint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Bootstrap** for the responsive UI framework
- **Chart.js** for beautiful data visualizations
- **Hugging Face** for AI model access
- **MongoDB** for reliable data storage
- **Vercel** for seamless deployment

## 📞 Support

If you have any questions or need help with deployment, please:
- Open an issue on GitHub
- Check the documentation
- Review the example environment variables

---

**Made with ❤️ for modern inventory management**