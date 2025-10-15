# Testing Guide for AI Agent Features

## Overview

This guide will help you test the new AI Agent features in the inventory app. The agent allows you to interact with your inventory using natural language instead of clicking through forms and buttons.

## Prerequisites

Before testing, ensure:
1. ✅ MongoDB is running (local or Atlas)
2. ✅ OpenAI API key is set in `dev.env`
3. ✅ Server is running (`npm run dev`)
4. ✅ Browser is open to `http://localhost:3000`

## Test Scenarios

### Test 1: Opening the Chat Interface

**What to do:**
1. Open `http://localhost:3000` in your browser
2. Look for the purple "AI Assistant" banner below the hero headline
3. Click the "Start Chat" button

**Expected result:**
- A chat widget should appear in the bottom-right corner
- The widget should show a welcome message from the AI
- You should see suggestion chips like "Low stock items", "Top products", "Add product"

**What this tests:** UI rendering and initialization

---

### Test 2: Adding a Product

**What to type:**
```
Add 50 blue cotton bed covers for $25 each
```

**Expected result:**
- AI should understand your request
- A new product should be added to the database
- AI should confirm: "Successfully added 50 units of 'blue cotton bed covers' to inventory"
- The response should show product details (name, quantity, price)

**Alternative commands to try:**
- "Create 30 silk cushion covers priced at $45"
- "Add 100 white towels for $12 each with a cost of $8"
- "New product: 20 sarees at $85"

**What this tests:** Product creation tool

---

### Test 3: Searching Products

**What to type:**
```
Show me all bed covers
```

**Expected result:**
- AI should list all bed cover products
- Each product should show: name, quantity in stock, price
- Response should indicate how many products were found

**Alternative commands to try:**
- "What products are low in stock?"
- "Find all silk products"
- "Search for towels"
- "Show me products with less than 10 units"

**What this tests:** Product search tool

---

### Test 4: Updating Inventory

**What to type:**
```
Increase the quantity of blue cotton bed covers by 25
```

**Expected result:**
- AI should find the product
- Update the quantity
- Confirm the change: "Updated 'blue cotton bed covers' quantity from 50 to 75"

**Alternative commands to try:**
- "Set the stock of white towels to 150"
- "Reduce silk cushion covers by 10"
- "Add 30 more units to sarees"

**What this tests:** Inventory update tool

---

### Test 5: Recording a Sale

**What to type:**
```
I just sold 5 blue cotton bed covers
```

**Expected result:**
- AI should record the sale
- Reduce inventory quantity by 5
- Show sale details: quantity sold, revenue, profit, remaining stock
- Confirm: "Recorded sale of 5 units of 'blue cotton bed covers'"

**Alternative commands to try:**
- "Record a sale: 10 towels for $120"
- "Mark 3 cushion covers as sold"
- "Sale of 2 sarees at $90 each"

**What this tests:** Sales recording tool

---

### Test 6: Viewing Analytics

**What to type:**
```
Show me this week's sales analytics
```

**Expected result:**
- AI should display analytics for the past week
- Response should include: total revenue, profit, sales count, quantity sold
- Should show top-selling products if any sales exist
- Should show inventory status (total products, low stock count)

**Alternative commands to try:**
- "What's my revenue for this month?"
- "Show me today's sales"
- "Give me analytics for the year"
- "What are my top selling products?"

**What this tests:** Analytics tool

---

### Test 7: Opening Catalog Pages

**What to type:**
```
Open the bed covers catalog
```

**Expected result:**
- AI should provide a clickable link to `/bed-covers`
- Response should say "Opening bed covers page..."
- You should be able to click the link to navigate

**Alternative commands to try:**
- "Show me the cushion covers catalog"
- "Take me to the analytics page"
- "Open inventory"
- "Show me the Coverz landing page"

**What this tests:** Navigation tool

---

### Test 8: Complex Multi-Step Interaction

**Conversation to have:**

1. **You:** "What products are low in stock?"
2. **AI:** [Lists low stock products]
3. **You:** "Add 50 more units to [product name from list]"
4. **AI:** [Updates inventory]
5. **You:** "Show me the updated quantity"
6. **AI:** [Searches and shows updated product]

**What this tests:** Conversation memory and context handling

---

### Test 9: Error Handling

**What to type:**
```
Sell 1000 units of nonexistent product
```

**Expected result:**
- AI should gracefully handle the error
- Should explain that the product doesn't exist
- Might suggest similar products if available

**Alternative error cases to try:**
- "Add a product" (missing details)
- "Update quantity to -50" (invalid value)
- "Sell more than available stock"

**What this tests:** Error handling and user feedback

---

### Test 10: Natural Language Variations

Try these casual, natural phrasings:

- "Hey, can you add 20 towels for me? They cost $15 each"
- "I need to know how we're doing this month"
- "Can you check if we have any blue bed covers?"
- "We just made a big sale - 30 cushion covers"
- "What's running low in the warehouse?"

**Expected result:**
- AI should understand all these variations
- Should execute the appropriate actions
- Should respond in a natural, conversational way

**What this tests:** Natural language understanding and flexibility

---

## Verification Checklist

After each test, verify:

- [ ] Response is clear and easy to understand
- [ ] Correct tool was used
- [ ] Database changes are reflected (check via inventory page)
- [ ] No errors in browser console
- [ ] No errors in server terminal
- [ ] Response time is reasonable (< 5 seconds)

## Common Issues and Solutions

### Issue: "OpenAI API key not configured"
**Solution:** 
- Check that `OPENAI_API_KEY` is in your `dev.env` file
- Restart the server after adding the key
- Make sure the key starts with `sk-`

### Issue: "Database connection not available"
**Solution:**
- Make sure MongoDB is running
- Check `MONGODB_URI` in `dev.env`
- Verify database connection in server logs

### Issue: Chat widget doesn't appear
**Solution:**
- Check browser console for JavaScript errors
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check that `ai-chat.css` and `ai-agent.js` are loading

### Issue: AI doesn't understand commands
**Solution:**
- Be more specific with details (product name, quantity, price)
- Try rephrasing using examples from this guide
- Check that you're using supported product types (bed-covers, cushion-covers, sarees, towels)

### Issue: Slow responses
**Solution:**
- This is normal for first request (cold start)
- Subsequent requests should be faster
- Check your internet connection
- Verify OpenAI API status

## Performance Notes

Expected response times:
- **First request:** 2-5 seconds (model initialization)
- **Subsequent requests:** 1-3 seconds
- **Simple queries:** < 2 seconds
- **Complex operations:** 2-4 seconds

## Browser Console Commands

For debugging, you can use these in the browser console:

```javascript
// Check if AI chat is initialized
console.log(aiChat);

// Manually send a message (for testing)
aiChat.chatInput.value = "Show me all products";
aiChat.sendMessage();

// Check conversation history
console.log(aiChat.conversationHistory);
```

## Server Logs to Monitor

Watch for these in your terminal:

```
✅ [DB] MongoDB Connected: ...
Processing agent request: [your message]
Executing tool: [tool name]
```

## Success Criteria

The AI Agent feature is working correctly if:

1. ✅ Chat widget opens and closes smoothly
2. ✅ AI understands at least 80% of natural language commands
3. ✅ All 6 tools execute successfully
4. ✅ Database changes persist
5. ✅ Responses are clear and helpful
6. ✅ Error messages are informative
7. ✅ UI is responsive and attractive
8. ✅ No console or server errors

## Next Steps

Once testing is complete:

1. **Document any issues** found during testing
2. **Note any confusing responses** from the AI
3. **Suggest improvements** to tool descriptions or prompts
4. **Test on different devices** (mobile, tablet)
5. **Try edge cases** not covered in this guide
6. **Get feedback** from other users

## Feedback Form

After testing, consider these questions:

- Which commands were easiest to use?
- Which commands were confusing?
- Did the AI ever misunderstand your intent?
- Were the responses helpful and clear?
- Would you use this instead of the traditional UI?
- What additional features would be useful?

## Automated Testing (Optional)

For developers, you can test the API directly:

```bash
# Test the chat endpoint
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me all products"
  }'

# Test the tools endpoint
curl http://localhost:3000/api/agent/tools
```

Happy testing! 🚀🤖

