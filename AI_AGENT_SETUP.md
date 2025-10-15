# AI Agent Setup Guide

## What is This?

This inventory app now includes an **AI Agent** - a smart assistant that understands natural language and helps you manage your inventory without clicking through menus. Just talk to it like you would to a colleague!

### What Can You Do?

Instead of clicking buttons and filling forms, you can simply type:
- "Add 50 blue cotton bed covers for $25"
- "Show me this week's sales analytics"
- "What products are low in stock?"
- "Record a sale of 10 towels"
- "Open the bed covers catalog"

The AI understands your intent and performs the action automatically!

## How It Works (Simple Explanation)

1. **You type a message** in natural language (like texting a friend)
2. **The AI reads your message** and figures out what you want to do
3. **It picks the right tool** (add product, search, view analytics, etc.)
4. **It performs the action** on your inventory
5. **It tells you what it did** in a friendly way

Think of it as having a smart assistant who knows your inventory system inside out!

## Setup Instructions

### Step 1: Get an OpenAI API Key

The AI uses GPT-4o-mini (OpenAI's fast and affordable model) to understand your requests.

1. Go to [OpenAI's website](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to "API Keys" section
4. Click "Create new secret key"
5. Copy the key (it looks like: `sk-...`)

**Cost:** GPT-4o-mini is very cheap - about $0.15 per 1 million input tokens. For typical usage, this means:
- ~1000 conversations = ~$0.01-0.05
- Very affordable for small businesses!

### Step 2: Add API Key to Your Environment

1. Open (or create) the file `dev.env` in the project root
2. Add this line:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
3. Replace `sk-your-actual-key-here` with your actual key
4. Save the file

### Step 3: Make Sure MongoDB is Running

The agent needs access to your inventory database:

```bash
# If using local MongoDB:
mongod

# Or if using MongoDB Atlas, make sure your MONGODB_URI is set in dev.env
```

### Step 4: Start the Server

```bash
npm install  # Install dependencies (if you haven't already)
npm run dev  # Start the development server
```

### Step 5: Open the App

1. Open your browser to `http://localhost:3000`
2. You'll see a purple banner at the top saying "New! AI Assistant"
3. Click "Start Chat" to open the chat interface
4. Start talking to your inventory!

## Example Commands to Try

### Adding Products
- "Add 30 silk cushion covers priced at $45 each"
- "Create a new product: 100 white towels for $12"
- "Add cotton sarees, quantity 20, price $85"

### Managing Inventory
- "Increase the quantity of blue bed covers by 50"
- "Set the stock of white towels to 75"
- "Reduce cushion covers by 10"

### Recording Sales
- "I just sold 5 silk sarees"
- "Record a sale: 15 towels for $180"
- "Mark 10 bed covers as sold"

### Searching Products
- "Show me all bed covers"
- "What products are low in stock?"
- "Search for silk products"
- "Find cushion covers"

### Viewing Analytics
- "Show me this week's sales"
- "What's my revenue for this month?"
- "Give me analytics for today"
- "Show me my top selling products"

### Opening Pages
- "Open the bed covers catalog"
- "Show me the analytics page"
- "Take me to the inventory"

## Tips for Best Results

1. **Be specific**: Include quantities, prices, and product types
2. **Use natural language**: Write like you're talking to a person
3. **One action at a time**: While the AI is smart, it's clearer if you ask for one thing per message
4. **Check the response**: The AI will show you what it did and confirm the action

## Troubleshooting

### "OpenAI API key not configured"
- Make sure you added `OPENAI_API_KEY` to your `dev.env` file
- Restart the server after adding the key

### "Database connection not available"
- Make sure MongoDB is running
- Check your `MONGODB_URI` in `dev.env`

### AI doesn't understand my request
- Try rephrasing more clearly
- Include specific details (product name, quantity, price)
- Look at the example commands above

### Chat button doesn't appear
- Make sure you're on the homepage (`http://localhost:3000`)
- Check browser console for JavaScript errors
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

## What's Happening Under the Hood? (Technical)

For those curious about the technology:

1. **Frontend**: Beautiful chat interface built with vanilla JavaScript and CSS
2. **Backend**: Express.js API endpoint (`/api/agent/chat`)
3. **AI Service**: Uses OpenAI's function calling feature with GPT-4o-mini
4. **Tools**: Pre-defined functions that interact with your MongoDB database
5. **Flow**: User message → AI understands intent → Picks appropriate tool → Executes action → Returns friendly response

## Security Notes

- Never commit your `dev.env` file to git (it's already in `.gitignore`)
- Keep your OpenAI API key secret
- Set up usage limits in OpenAI dashboard to control costs
- For production, use environment variables provided by your hosting platform

## Cost Management

To keep costs low:
1. Set a monthly budget in OpenAI dashboard
2. Use the free tier initially (comes with credits)
3. Monitor usage in OpenAI dashboard
4. GPT-4o-mini is the most cost-effective model

## Next Steps

Once you're comfortable with the AI agent:
- Train your team on natural language commands
- Customize the tool descriptions for your specific use case
- Add more tools for specialized operations
- Integrate with other systems (if needed)

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server terminal for error messages
3. Verify all environment variables are set correctly
4. Make sure all dependencies are installed (`npm install`)

Happy chatting with your inventory! 🤖📦

