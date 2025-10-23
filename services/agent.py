import asyncio
import logging
import os
import json
import aiohttp
from typing import Annotated, Optional
from livekit import agents, rtc
from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
    AgentSession,
    Agent,
    function_tool,
    RunContext,
    ToolError
)
from livekit.plugins import deepgram, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inventory-voice-agent")

# API Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")

# ===========================================
# HELPER FUNCTIONS
# ===========================================

async def call_inventory_api(endpoint: str, method: str = "GET", data: dict = None):
    """Helper function to call the Node.js inventory API"""
    url = f"{API_BASE_URL}{endpoint}"
    
    try:
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url) as response:
                    return await response.json()
            elif method == "POST":
                async with session.post(url, json=data) as response:
                    return await response.json()
            elif method == "PUT":
                async with session.put(url, json=data) as response:
                    return await response.json()
            elif method == "DELETE":
                async with session.delete(url) as response:
                    return await response.json()
    except Exception as e:
        logger.error(f"API call failed: {endpoint} - {str(e)}")
        return {"success": False, "error": str(e)}


# ===========================================
# INVENTORY AGENT CLASS
# ===========================================

class InventoryAgent(Agent):
    """Voice AI agent for textile inventory management system."""
    
    def __init__(self):
        super().__init__(
            instructions="""You are a helpful AI assistant for a textile inventory management system. 
            You help users manage their inventory of bed covers, cushion covers, sarees, and towels.
            
            You can:
            - Add, update, delete, and search products
            - Record sales transactions
            - View sales analytics and profit statistics
            - Get top selling products
            - View low stock alerts
            - Analyze sales trends
            
            CRITICAL: When the user mentions a SKU code, extract it properly:
            - User says "Add 30 cushion covers for $45 SKU CC 003" → sku: "CC-003"
            - User says "Add bed cover with SKU BC-001 for $50" → sku: "BC-001"  
            - User says "Add 10 towels for $15" (no SKU mentioned) → sku: undefined (will auto-generate)

            DO NOT put the SKU in the description field. Extract the alphanumeric code and put it in the sku parameter.
            
            SEARCHING BY SKU - CRITICAL:
            When the user asks about a product by SKU (e.g., "How many cc-002 are there?" or "Find SKU bc-001"):
            - Use the search_products tool with the SKU as the search_term parameter
            - Example: User asks "How many products of SKU cc-002 are there" → call search_products(search_term="cc-002")
            - The search will find products by SKU, name, or description
            - Format SKUs with hyphens when speaking them (e.g., "CC-002" not "cc 002" or "CC 002")

            Category Instructions:
            Categories are: bed-covers, cushion-covers, sarees, towels. If its one word, its in lowercase, if its two words, its in lowercase and separated by a hyphen.
            When the user mentions a category, always map them to the category above
            
            COST BREAKDOWN INSTRUCTIONS - CRITICAL:
            When the user mentions multiple cost components, extract them into BOTH cost_breakdown AND cost parameters:
            
            Example 1: "Add cushion cover, material $20, embroidery $10, making charge $5"
            → cost_breakdown: '[{"category":"Material","amount":20},{"category":"Embroidery","amount":10},{"category":"Making Charge","amount":5}]'
            → cost: 35
            
            Example 2: "Add bed cover with material cost $30, embroidery $15, end stitching $8, printing $12"
            → cost_breakdown: '[{"category":"Material","amount":30},{"category":"Embroidery","amount":15},{"category":"End Stitching","amount":8},{"category":"Printing","amount":12}]'
            → cost: 65
            
            Example 3: "Add saree with material $40, embroidery $20, printing $15"
            → cost_breakdown: '[{"category":"Material","amount":40},{"category":"Embroidery","amount":20},{"category":"Printing","amount":15}]'
            → cost: 75
            
            Common cost categories by product type:
            - All products: Material, Embroidery (required)
            - Cushion covers: Making Charge
            - Bed covers: End Stitching, Printing
            - Sarees: Printing
            - Towels: Material, Embroidery only
            
            If user only mentions total cost without breakdown, just set the cost parameter.
            If user mentions components, ALWAYS create the JSON array for cost_breakdown AND sum for cost.

            Be conversational, friendly, and efficient. When the user makes a request:
            1. Understand their intent
            2. Use the appropriate tool(s)
            3. Provide a clear, human-friendly response about what you did
            
            When providing information, be specific with numbers and details."""
        )
        # Note: Tools are auto-registered via @function_tool() decorators on the methods below
        # No need to pass them in tools= parameter to avoid duplicates
    
    # ===========================================
    # PRODUCT TOOLS
    # ===========================================
    
    @function_tool()
    async def add_product(
        self,
        context: RunContext,
        name: Annotated[str, "The name of the product"],
        type: Annotated[str, "Product type: bed-covers, cushion-covers, sarees, or towels"],
        quantity: Annotated[int, "The quantity to add"],
        price: Annotated[float, "The selling price per unit in dollars"],
        sku: Annotated[Optional[str], "SKU code (optional, will auto-generate if not provided)"] = None,
        cost: Annotated[Optional[float], "Total cost price per unit in dollars (optional)"] = None,
        cost_breakdown: Annotated[Optional[str], "Cost breakdown as JSON string with categories and amounts, e.g., '[{\"category\":\"Material\",\"amount\":20},{\"category\":\"Embroidery\",\"amount\":10}]' (optional)"] = None,
        description: Annotated[Optional[str], "Product description (optional, max 500 chars)"] = None,
        caption: Annotated[Optional[str], "Short caption or tagline (optional, max 200 chars)"] = None,
    ):
        """Add a new product to the inventory. Use when user wants to add, create, or insert a new product.
        
        Args:
            context: The execution context
            name: The name of the product
            type: Product type: bed-covers, cushion-covers, sarees, or towels
            quantity: The quantity to add
            price: The selling price per unit in dollars
            sku: SKU code (optional, will auto-generate if not provided)
            cost: Total cost price per unit in dollars (optional)
            cost_breakdown: Cost breakdown as JSON string with categories and amounts (optional)
            description: Product description (optional, max 500 chars)
            caption: Short caption or tagline (optional, max 200 chars)
        """
        
        product_data = {
            "name": name,
            "type": type,
            "quantity": quantity,
            "price": price,
        }
        
        if sku:
            product_data["sku"] = sku
        if cost is not None:
            product_data["cost"] = cost
        if description:
            product_data["description"] = description
        if caption:
            product_data["caption"] = caption
        
        # Parse cost breakdown if provided
        if cost_breakdown:
            try:
                product_data["costBreakdown"] = json.loads(cost_breakdown)
            except Exception as e:
                logger.warning(f"Failed to parse cost_breakdown: {cost_breakdown}, error: {e}")
        
        result = await call_inventory_api("/api/products", "POST", product_data)
        
        if result.get("success"):
            product = result.get("data", {})
            breakdown_msg = ""
            if product.get("costBreakdown"):
                breakdown_items = [f"{item['category']}: ${item['amount']}" for item in product.get("costBreakdown", [])]
                breakdown_msg = f" Cost breakdown: {', '.join(breakdown_items)}."
            return f"Successfully added {quantity} units of '{name}' (SKU: {product.get('sku')}) to inventory at ${price} per unit.{breakdown_msg}"
        else:
            raise ToolError(f"Failed to add product: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def update_product(
        self,
        context: RunContext,
        product_identifier: Annotated[str, "Product name, SKU, or ID to update"],
        name: Annotated[Optional[str], "New product name (optional)"] = None,
        sku: Annotated[Optional[str], "New SKU (optional)"] = None,
        type: Annotated[Optional[str], "New product type (optional)"] = None,
        quantity: Annotated[Optional[int], "New quantity (optional)"] = None,
        price: Annotated[Optional[float], "New price (optional)"] = None,
        cost: Annotated[Optional[float], "New cost (optional)"] = None,
        cost_breakdown: Annotated[Optional[str], "New cost breakdown as JSON string (optional)"] = None,
        description: Annotated[Optional[str], "New description (optional)"] = None,
        caption: Annotated[Optional[str], "New caption (optional)"] = None,
    ):
        """Update an existing product's details like name, SKU, price, cost, description, caption, cost breakdown, etc.
        
        Args:
            context: The execution context
            product_identifier: Product name, SKU, or ID to update
            name: New product name (optional)
            sku: New SKU (optional)
            type: New product type (optional)
            quantity: New quantity (optional)
            price: New price (optional)
            cost: New cost (optional)
            cost_breakdown: New cost breakdown as JSON string (optional)
            description: New description (optional)
            caption: New caption (optional)
        """
        
        update_data = {"product_identifier": product_identifier}
        if name:
            update_data["name"] = name
        if sku:
            update_data["sku"] = sku
        if type:
            update_data["type"] = type
        if quantity is not None:
            update_data["quantity"] = quantity
        if price is not None:
            update_data["price"] = price
        if cost is not None:
            update_data["cost"] = cost
        if description:
            update_data["description"] = description
        if caption:
            update_data["caption"] = caption
        
        # Parse cost breakdown if provided
        if cost_breakdown:
            try:
                update_data["costBreakdown"] = json.loads(cost_breakdown)
            except Exception as e:
                logger.warning(f"Failed to parse cost_breakdown: {cost_breakdown}, error: {e}")
        
        result = await call_inventory_api(f"/api/products/{product_identifier}", "PUT", update_data)
        
        if result.get("success"):
            updated_product = result.get("data", {})
            fields_updated = []
            if name:
                fields_updated.append("name")
            if price is not None:
                fields_updated.append(f"price (${price})")
            if cost is not None:
                fields_updated.append(f"cost (${cost})")
            if quantity is not None:
                fields_updated.append(f"quantity ({quantity})")
            
            fields_str = ", ".join(fields_updated) if fields_updated else "product details"
            return f"Successfully updated {fields_str} for '{product_identifier}'."
        else:
            raise ToolError(f"Failed to update product: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def update_inventory(
        self,
        context: RunContext,
        product_name: Annotated[str, "The name or partial name of the product to update"],
        quantity_change: Annotated[Optional[int], "Amount to change quantity by (positive to add, negative to subtract)"] = None,
        new_quantity: Annotated[Optional[int], "Or set a specific new quantity"] = None,
    ):
        """Update the quantity of an existing product. Use when user wants to increase, decrease, or change stock levels.
        
        Args:
            context: The execution context
            product_name: The name or partial name of the product to update
            quantity_change: Amount to change quantity by (positive to add, negative to subtract)
            new_quantity: Or set a specific new quantity
        """
        
        update_data = {
            "product_name": product_name,
        }
        if quantity_change is not None:
            update_data["quantity_change"] = quantity_change
        if new_quantity is not None:
            update_data["new_quantity"] = new_quantity
        
        result = await call_inventory_api(f"/api/products/quantity/{product_name}", "PUT", update_data)
        
        if result.get("success"):
            return f"Successfully updated inventory for '{product_name}'. {result.get('message', '')}"
        else:
            raise ToolError(f"Failed to update inventory: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def search_products(
        self,
        context: RunContext,
        search_term: Annotated[Optional[str], "Search term for product name, description, or SKU"] = None,
        type: Annotated[Optional[str], "Filter by type: bed-covers, cushion-covers, sarees, towels"] = None,
        low_stock: Annotated[bool, "Only show products with low stock (quantity < 10)"] = False,
    ):
        """Search for products in the inventory. Use when user wants to find, search, or look up products.
        
        Args:
            context: The execution context
            search_term: Search term for product name, description, or SKU
            type: Filter by type: bed-covers, cushion-covers, sarees, towels
            low_stock: Only show products with low stock (quantity < 10)
        """
        
        params = {}
        if search_term:
            params["search"] = search_term
        if type:
            params["type"] = type
        if low_stock:
            params["lowStock"] = "true"
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        endpoint = f"/api/products?{query_string}" if query_string else "/api/products"
        
        result = await call_inventory_api(endpoint, "GET")
        
        if result.get("success"):
            products = result.get("data", [])
            if not products:
                return "No products found matching your search."
            
            response = f"Found {len(products)} product(s):\n"
            for p in products[:5]:  # Limit to 5 for voice response
                response += f"- {p.get('name')} (SKU: {p.get('sku')}, Quantity: {p.get('quantity')}, Price: ${p.get('price')})\n"
            
            if len(products) > 5:
                response += f"... and {len(products) - 5} more."
            
            return response
        else:
            raise ToolError(f"Search failed: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def list_products(
        self,
        context: RunContext,
        type: Annotated[Optional[str], "Filter by type: bed-covers, cushion-covers, sarees, towels, or all"] = None,
        low_stock: Annotated[bool, "Only show low stock products"] = False,
    ):
        """List all products with optional filtering. Use when user wants to see all products or products of a specific type.
        
        Args:
            context: The execution context
            type: Filter by type: bed-covers, cushion-covers, sarees, towels, or all
            low_stock: Only show low stock products
        """
        
        params = {}
        if type and type != "all":
            params["type"] = type
        if low_stock:
            params["lowStock"] = "true"
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        endpoint = f"/api/products?{query_string}" if query_string else "/api/products"
        
        result = await call_inventory_api(endpoint, "GET")
        
        if result.get("success"):
            products = result.get("data", [])
            if not products:
                return "No products found."
            
            response = f"Found {len(products)} product(s):\n"
            for p in products[:5]:
                response += f"- {p.get('name')} (SKU: {p.get('sku')}, Qty: {p.get('quantity')}, Price: ${p.get('price')})\n"
            
            if len(products) > 5:
                response += f"... and {len(products) - 5} more."
            
            return response
        else:
            raise ToolError(f"Failed to list products: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def get_product(
        self,
        context: RunContext,
        product_identifier: Annotated[str, "Product name, SKU, or ID"],
    ):
        """Get detailed information about a specific product by name, SKU, or ID.
        
        Args:
            context: The execution context
            product_identifier: Product name, SKU, or ID
        """
        
        result = await call_inventory_api(f"/api/products/{product_identifier}", "GET")
        
        if result.get("success"):
            product = result.get("data", {})
            return (f"Product: {product.get('name')}, SKU: {product.get('sku')}, "
                    f"Type: {product.get('type')}, Quantity: {product.get('quantity')}, "
                    f"Price: ${product.get('price')}, Cost: ${product.get('cost', 0)}")
        else:
            raise ToolError(f"Product not found: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def delete_product(
        self,
        context: RunContext,
        product_identifier: Annotated[str, "Product name, SKU, or ID to delete"],
    ):
        """Delete a product from inventory. Use when user wants to remove a product permanently.
        
        Args:
            context: The execution context
            product_identifier: Product name, SKU, or ID to delete
        """
        
        result = await call_inventory_api(f"/api/products/{product_identifier}", "DELETE")
        
        if result.get("success"):
            return f"Successfully deleted product '{product_identifier}'."
        else:
            raise ToolError(f"Failed to delete product: {result.get('error', 'Unknown error')}")


    # ===========================================
    # SALES TOOLS
    # ===========================================
    
    @function_tool()
    async def record_sale(
        self,
        context: RunContext,
        product_name: Annotated[str, "The name, SKU, or ID of the product being sold"],
        quantity: Annotated[int, "The quantity being sold"],
        sell_price: Annotated[Optional[float], "The actual sale price per unit (optional, uses product list price if not provided)"] = None,
    ):
        """Record a sale of a product. Use when user mentions selling, sold, or making a sale. Automatically reduces product quantity.
        
        Args:
            context: The execution context
            product_name: The name, SKU, or ID of the product being sold
            quantity: The quantity being sold
            sell_price: The actual sale price per unit (optional, uses product list price if not provided)
        """
        
        sale_data = {
            "productName": product_name,
            "quantity": quantity,
        }
        
        if sell_price is not None:
            sale_data["sellPrice"] = sell_price
        
        result = await call_inventory_api("/api/sales", "POST", sale_data)
        
        if result.get("success"):
            sale = result.get("data", {})
            return (f"Sale recorded! Sold {quantity} units of {product_name}. "
                    f"Total: ${sale.get('totalSaleValue', 0):.2f}, "
                    f"Profit: ${sale.get('profit', 0):.2f}")
        else:
            raise ToolError(f"Failed to record sale: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def get_sales_history(
        self,
        context: RunContext,
        product_name: Annotated[Optional[str], "Filter by product name or SKU (optional)"] = None,
        start_date: Annotated[Optional[str], "Start date for range in ISO format (optional)"] = None,
        end_date: Annotated[Optional[str], "End date for range in ISO format (optional)"] = None,
        limit: Annotated[int, "Maximum number of sales to return"] = 10,
    ):
        """Get sales history with optional filtering by product, date range, etc.
        
        Args:
            context: The execution context
            product_name: Filter by product name or SKU (optional)
            start_date: Start date for range in ISO format (optional)
            end_date: End date for range in ISO format (optional)
            limit: Maximum number of sales to return
        """
        
        params = {"limit": str(limit)}
        if product_name:
            params["product"] = product_name
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        endpoint = f"/api/sales?{query_string}"
        
        result = await call_inventory_api(endpoint, "GET")
        
        if result.get("success"):
            sales = result.get("data", [])
            if not sales:
                return "No sales found for the specified criteria."
            
            response = f"Found {len(sales)} sale(s):\n"
            for sale in sales[:5]:
                product_name = sale.get('productId', {}).get('name', 'Unknown') if isinstance(sale.get('productId'), dict) else 'Unknown'
                response += (f"- {product_name} ({sale.get('quantity')} units, "
                            f"${sale.get('totalSaleValue', 0):.2f}, Profit: ${sale.get('profit', 0):.2f})\n")
            
            return response
        else:
            raise ToolError(f"Failed to get sales history: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def get_recent_sales(
        self,
        context: RunContext,
        limit: Annotated[int, "Number of recent sales to retrieve"] = 5,
    ):
        """Get the most recent sales transactions.
        
        Args:
            context: The execution context
            limit: Number of recent sales to retrieve
        """
        
        result = await call_inventory_api(f"/api/sales?limit={limit}", "GET")
        
        if result.get("success"):
            sales = result.get("data", [])
            if not sales:
                return "No sales recorded yet."
            
            response = f"Recent {len(sales)} sale(s):\n"
            for sale in sales:
                product_name = sale.get('productId', {}).get('name', 'Unknown') if isinstance(sale.get('productId'), dict) else 'Unknown'
                response += (f"- {product_name} "
                            f"({sale.get('quantity')} units, ${sale.get('totalSaleValue', 0):.2f})\n")
            
            return response
        else:
            raise ToolError(f"Failed to get sales: {result.get('error', 'Unknown error')}")


    # ===========================================
    # ANALYTICS TOOLS
    # ===========================================

    @function_tool()
    async def get_inventory_summary(
        self,
        context: RunContext,
    ):
        """Get comprehensive inventory summary including total products, value, low stock alerts, and breakdown by type.
        
        Args:
            context: The execution context
        """
        
        result = await call_inventory_api("/api/analytics/summary", "GET")
        
        if result.get("success"):
            summary = result.get("data", {})
            return (f"Inventory Summary: {summary.get('totalProducts', 0)} products, "
                    f"Total value: ${summary.get('totalValue', 0):.2f}, "
                    f"Low stock items: {summary.get('lowStockCount', 0)}")
        else:
            raise ToolError(f"Failed to get summary: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def view_analytics(
        self,
        context: RunContext,
        period: Annotated[str, "Time period: today, week, month, 2months, year, or all"],
    ):
        """Get sales analytics and insights. Use when user asks about sales, revenue, profit, or performance.
        
        Args:
            context: The execution context
            period: Time period: today, week, month, 2months, year, or all
        """
        
        result = await call_inventory_api(f"/api/analytics/profit?period={period}", "GET")
        
        if result.get("success"):
            data = result.get("data", {})
            return (f"Analytics for {period}: "
                    f"Revenue: ${data.get('totalRevenue', 0):.2f}, "
                    f"Profit: ${data.get('totalProfit', 0):.2f}, "
                    f"Sales: {data.get('salesCount', 0)}, "
                    f"Profit margin: {data.get('profitMargin', 0):.1f}%")
        else:
            raise ToolError(f"Failed to get analytics: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def get_profit_stats(
        self,
        context: RunContext,
        period: Annotated[str, "Time period: today, week, month, 2months, year, or all"] = "month",
    ):
        """Get detailed profit statistics and financial performance.
        
        Args:
            context: The execution context
            period: Time period: today, week, month, 2months, year, or all
        """
        
        result = await call_inventory_api(f"/api/analytics/profit?period={period}", "GET")
        
        if result.get("success"):
            data = result.get("data", {})
            return (f"Profit stats for {period}: "
                    f"Total profit: ${data.get('totalProfit', 0):.2f}, "
                    f"Revenue: ${data.get('totalRevenue', 0):.2f}, "
                    f"Cost: ${data.get('totalCost', 0):.2f}, "
                    f"Average profit per sale: ${data.get('averageProfit', 0):.2f}")
        else:
            raise ToolError(f"Failed to get profit stats: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def get_monthly_profits(
        self,
        context: RunContext,
        months: Annotated[int, "Number of months to retrieve"] = 6,
    ):
        """Get monthly profit breakdown for the specified number of months.
        
        Args:
            context: The execution context
            months: Number of months to retrieve
        """
        
        result = await call_inventory_api(f"/api/analytics/monthly-profits?months={months}", "GET")
        
        if result.get("success"):
            data = result.get("data", [])
            if not data:
                return "No profit data available."
            
            response = f"Monthly profits (last {months} months):\n"
            for month_data in data[:5]:
                response += f"- {month_data.get('month', 'Unknown')}: ${month_data.get('profit', 0):.2f}\n"
            
            return response
        else:
            raise ToolError(f"Failed to get monthly profits: {result.get('error', 'Unknown error')}")


    @function_tool()
    async def get_top_products(
        self,
        context: RunContext,
        period: Annotated[str, "Time period: today, week, month, 2months, year, or all"] = "month",
        sort_by: Annotated[str, "Sort by: revenue, quantity, or profit"] = "revenue",
        limit: Annotated[int, "Number of top products to return"] = 5,
    ):
        """Get top selling products ranked by revenue, quantity sold, or profit.
        
        Args:
            context: The execution context
            period: Time period: today, week, month, 2months, year, or all
            sort_by: Sort by: revenue, quantity, or profit
            limit: Number of top products to return
        """
        
        result = await call_inventory_api(
            f"/api/analytics/top-products?period={period}&sortBy={sort_by}&limit={limit}", 
            "GET"
        )
        
        if result.get("success"):
            products = result.get("data", [])
            if not products:
                return f"No sales data available for {period}."
            
            response = f"Top {len(products)} product(s) by {sort_by} for {period}:\n"
            for i, p in enumerate(products, 1):
                response += f"{i}. {p.get('name', 'Unknown')} (SKU: {p.get('sku', 'N/A')}, Profit: ${p.get('profit', 0):.2f})\n"
            
            return response
        else:
            raise ToolError(f"Failed to get top products: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def get_low_stock_alerts(
        self,
        context: RunContext,
        threshold: Annotated[int, "Stock threshold for alerts"] = 10,
    ):
        """Get products that are low in stock or out of stock.
        
        Args:
            context: The execution context
            threshold: Stock threshold for alerts
        """
        
        result = await call_inventory_api(f"/api/analytics/low-stock?threshold={threshold}", "GET")
        
        if result.get("success"):
            products = result.get("data", [])
            if not products:
                return "No low stock alerts. All products are well stocked."
            
            response = f"{len(products)} low stock alert(s):\n"
            for p in products[:5]:
                response += f"- {p.get('name')} (Quantity: {p.get('quantity')}, SKU: {p.get('sku')})\n"
            
            if len(products) > 5:
                response += f"... and {len(products) - 5} more items need restocking."
            
            return response
        else:
            raise ToolError(f"Failed to get alerts: {result.get('error', 'Unknown error')}")

    @function_tool()
    async def get_sales_trends(
        self,
        context: RunContext,
        period: Annotated[str, "Period for trend analysis: week, month, 2months, or year"] = "month",
    ):
        """Get sales trends and patterns over time.
        
        Args:
            context: The execution context
            period: Period for trend analysis: week, month, 2months, or year
        """
        
        result = await call_inventory_api(f"/api/analytics/trends?period={period}", "GET")
        
        if result.get("success"):
            data = result.get("data", {})
            return (f"Sales trends for {period}: "
                    f"Total sales: {data.get('totalSales', 0)}, "
                    f"Average per day: {data.get('averagePerDay', 0):.1f}, "
                    f"Trend: {data.get('trend', 'stable')}")
        else:
            raise ToolError(f"Failed to get trends: {result.get('error', 'Unknown error')}")


# ===========================================
# AGENT ENTRYPOINT
# ===========================================

async def entrypoint(ctx: JobContext):
    """Main entrypoint for the inventory voice agent"""
    
    logger.info(f"Starting inventory voice agent for room: {ctx.room.name}")
    
    # Create AgentSession with voice AI providers
    # Using direct plugin instances to bypass inference gateway
    session = AgentSession(
        stt=deepgram.STT(),  # Direct Deepgram Speech-to-text plugin
        llm=openai.LLM(model="gpt-4o-mini"),  # OpenAI Language model
        tts=openai.TTS(model="tts-1", voice="alloy"),  # OpenAI Text-to-speech (as per OpenAI docs)
        vad=silero.VAD.load(),  # Voice Activity Detection
        turn_detection=MultilingualModel(),  # Turn detection for interruptions
    )
    
    # Create the inventory agent instance (tools are auto-discovered from @function_tool decorated methods)
    agent = InventoryAgent()
    
    # Start the agent session
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    logger.info("Inventory voice agent started successfully")


# ===========================================
# MAIN
# ===========================================

if __name__ == "__main__":
    # Configure worker options
    worker_options = WorkerOptions(
        entrypoint_fnc=entrypoint,
    )
    
    # Run the worker
    cli.run_app(worker_options)