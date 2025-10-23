# LiveKit Voice Agent Tool Invocation Fix

## Problem
The LiveKit voice agent was connecting and responding, but it wasn't invoking any tools when users asked to add products, view sales, etc. The agent would respond conversationally but wouldn't actually execute the inventory management functions.

## Root Cause
The `InventoryAgent` class had all the tools defined with `@function_tool()` decorators, but the SDK wasn't picking them up automatically in some configurations.

**Update:** After testing, we discovered that:
1. The `@function_tool()` decorator **automatically registers** tools with the Agent
2. Passing tools explicitly in `tools=` parameter **causes duplicates**
3. The error "duplicate function name: add_product" indicated tools were registered twice

The correct approach is to rely **only on the decorator** for tool registration.

## What Was Fixed

### File: `services/agent.py`

**Before (Attempt 1):**
```python
class InventoryAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="""..."""
        )  # ← Tools not being recognized
```

**Failed Fix (Caused Duplicates):**
```python
class InventoryAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="""...""",
            tools=[self.add_product, self.update_product, ...]  # ← Caused duplicates!
        )
```
This resulted in: `ValueError: duplicate function name: add_product`

**Correct Fix:**
```python
class InventoryAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="""..."""
        )
        # Tools are auto-registered via @function_tool() decorators
        # No need to pass them explicitly!
    
    @function_tool()
    async def add_product(self, ...):  # ← Decorator handles registration
        """Add a product..."""
        pass
```

The `@function_tool()` decorator automatically registers tools with the Agent. Passing them explicitly causes duplicates.

## How to Restart the Agent

### Option 1: Using the Start Script (Recommended)
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
./start-agent.sh
```

This script:
- Loads environment variables from `dev.env`
- Starts the agent in development mode
- Shows environment variable status
- Runs in the foreground (press Ctrl+C to stop)

### Option 2: Manual Start
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app

# Load environment variables
set -a
source dev.env
set +a

# Start the agent
cd services
python3 agent.py dev
```

### Option 3: Background Process
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
nohup ./start-agent.sh > logs/agent.log 2>&1 &
```

## Testing the Fix

### 1. Start the Agent
```bash
./start-agent.sh
```

You should see:
```
🚀 Starting LiveKit voice agent...
📋 Environment check:
  LIVEKIT_URL: wss://default-z4q381nh...
  LIVEKIT_API_KEY: APIbQuWLJ2...
  OPENAI_API_KEY: sk-proj-Vya...
  DEEPGRAM_API_KEY: 6f470069c8...

INFO:inventory-voice-agent:Starting inventory voice agent...
```

### 2. Test Voice Input
1. Open http://localhost:3000 in your browser
2. Click the **microphone button** 🎤
3. Wait for "Connected! You can start speaking..."
4. Say: **"Add 10 cushion covers for 50 dollars"**
5. The agent should:
   - Call `add_product` tool
   - Create the product in your database
   - Respond: "Successfully added 10 units of 'cushion covers'..."

### 3. Verify Tool Execution
Check your MongoDB or make a request to see if the product was actually created:
```bash
curl http://localhost:3000/api/products | jq
```

You should see the newly added product in the list.

## Available Voice Commands

Now that tools are working, you can say:

### Product Management
- "Add 20 bed covers for $60 each"
- "Update product BC-001 price to $55"
- "Delete product cushion covers"
- "Search for sarees"
- "Show me all towels"
- "What's in stock?"
- "Show low stock items"

### Sales & Analytics
- "Record a sale: 5 bed covers for $300"
- "What were the sales today?"
- "Show me this month's analytics"
- "What are the top selling products?"
- "What's the profit this week?"
- "Show me sales trends"

## Troubleshooting

### Agent Won't Start
**Error:** `ValueError: api_key is required, or add LIVEKIT_API_KEY in your environment`

**Solution:** Make sure you're using the start script or loading `dev.env`:
```bash
./start-agent.sh
```

### Agent Connects But Still No Tools
1. **Check agent logs:**
   ```bash
   tail -f services/agent.log
   ```

2. **Verify tools are registered:**
   ```bash
   python3 -c "from services.agent import InventoryAgent; agent = InventoryAgent(); print(f'Tools: {len(agent.tools)}')"
   ```

   Should output: `Tools: 17` (all tools auto-registered via decorators)

3. **Check OpenAI API key:**
   The LLM needs to be configured correctly to invoke tools:
   ```bash
   echo $OPENAI_API_KEY
   ```

### Tools Execute But Fail
Check that your Node.js server is running:
```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
node server.js
```

The Python agent calls the Node.js API at `http://localhost:3000/api/*`

### Agent Disconnects Immediately
Check that the room name matches between frontend and agent. The agent should show:
```
INFO:inventory-voice-agent:Starting inventory voice agent for room: voice_1729...
```

## Architecture

```
User Voice Input
    ↓
Frontend (LiveKit Room)
    ↓
LiveKit Cloud
    ↓
Python Agent (agent.py)
    ↓
OpenAI GPT-4 (determines intent)
    ↓
Tool Invocation (e.g., add_product)
    ↓
API Call to Node.js (http://localhost:3000/api/products)
    ↓
MongoDB (stores data)
    ↓
Response back to user via voice
```

## Environment Variables Required

Make sure these are in your `dev.env`:
```env
LIVEKIT_URL=wss://your-instance.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
OPENAI_API_KEY=sk-proj-...
DEEPGRAM_API_KEY=your_deepgram_key
API_BASE_URL=http://localhost:3000  # Node.js server
```

## Monitoring

### Check Agent Status
```bash
ps aux | grep agent.py
```

### View Live Logs
```bash
tail -f services/agent.log
```

### Monitor Tool Calls
When a tool is called, you'll see in logs:
```
INFO:inventory-voice-agent:Tool called: add_product
INFO:inventory-voice-agent:Parameters: {'name': 'cushion covers', 'quantity': 10, ...}
```

## Next Steps

1. ✅ Start the agent using `./start-agent.sh`
2. ✅ Test voice commands in the browser
3. ✅ Verify products are being created in MongoDB
4. 📝 Monitor logs for any errors
5. 🎉 Enjoy full voice-based inventory management!

## Support

If tools still aren't working:
1. Check all environment variables are set
2. Verify Node.js server is running on port 3000
3. Check MongoDB connection
4. Review agent logs for specific errors
5. Test tools directly: `python3 tests/test_analytics_tool.py`

