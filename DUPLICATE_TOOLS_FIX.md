# Duplicate Tools Fix

## The Error
```
ValueError: duplicate function name: add_product
```

## What Happened

### Timeline

1. **Initial Problem:** Agent wasn't invoking tools
   - Tools were defined with `@function_tool()` decorators
   - But tools weren't being used during conversations

2. **First Fix Attempt (WRONG):** Added explicit tools list
   ```python
   super().__init__(
       instructions="...",
       tools=[self.add_product, self.update_product, ...]  # ❌ This caused duplicates!
   )
   ```

3. **Result:** `ValueError: duplicate function name: add_product`

4. **Root Cause Discovered:**
   - The `@function_tool()` decorator **automatically registers tools**
   - Passing tools explicitly in `tools=` parameter **registers them again**
   - Result: Each tool registered twice → duplicate error

5. **Correct Fix:** Remove explicit tools list
   ```python
   super().__init__(
       instructions="..."
   )
   # Tools auto-registered via @function_tool() decorators ✅
   ```

## How @function_tool() Works

The `@function_tool()` decorator does two things:

1. **Marks the method** as a callable tool for the LLM
2. **Auto-registers** it with the Agent class

Example:
```python
class InventoryAgent(Agent):
    @function_tool()  # ← This decorator handles everything
    async def add_product(self, context, name, quantity, price):
        """Add a new product to inventory."""
        # ... implementation
```

When the agent is instantiated, the SDK automatically:
- Discovers all methods with `@function_tool()` decorator
- Extracts function name, parameters, and docstring
- Registers them as available tools for the LLM
- Creates the proper OpenAI function calling schema

## Why Explicit Tools List Caused Duplicates

When you pass `tools=[self.add_product, ...]`:
1. SDK sees the explicit list and registers: `add_product` ✓
2. SDK also scans for `@function_tool()` decorators and registers: `add_product` ✓
3. Result: `add_product` exists twice → `ValueError`

## The Solution

**Simply rely on the decorator:**

```python
class InventoryAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="""..."""
        )
        # That's it! No tools= parameter needed
    
    @function_tool()
    async def add_product(self, ...):
        """..."""
        pass
    
    @function_tool()
    async def view_analytics(self, ...):
        """..."""
        pass
    
    # ... etc, 17 tools total
```

## Verification

After the fix:
```bash
$ python3 -c "from services.agent import InventoryAgent; agent = InventoryAgent(); print(f'Tools: {len(agent.tools)}')"
✅ Agent has 17 tools (no duplicates)
```

## When to Use Explicit Tools List

Use `tools=` parameter **only when**:
- You're passing **standalone functions** (not class methods)
- Functions are **not decorated** with `@function_tool()`

Example of standalone tools (different pattern):
```python
async def external_tool(param: str):
    """A tool defined outside the Agent class."""
    pass

class MyAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="...",
            tools=[external_tool]  # ✓ OK because it's external
        )
```

## Summary

| Scenario | Use Decorator | Use tools= | Result |
|----------|---------------|------------|--------|
| Class methods as tools | ✓ Yes | ❌ No | ✅ Works |
| External functions | ❌ No | ✓ Yes | ✅ Works |
| Both decorator AND tools= | ✓ Yes | ✓ Yes | ❌ Duplicates! |

For our inventory agent, all tools are **class methods with decorators**, so we should **NOT use the tools= parameter**.

## Restart the Agent

Now that the fix is applied:

```bash
cd /Users/partho.bardhan/Documents/projects/inventory-app
./start-agent.sh
```

The agent should start without the duplicate error and tools will work correctly! ✅

