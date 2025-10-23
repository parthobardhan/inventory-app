"""
Test for the voice agent's view_analytics functionality using LiveKit AgentSession.
This test verifies tool usage and expected behavior for the prompt:
"What is current month sales?"

NOTE: This test file uses APIs (mock_tools, session.run) that are not available in
livekit-agents 1.2.15. See test_analytics_tool.py for working tests using
direct tool invocation approach.
"""

import pytest
from typing import Annotated
from livekit.agents import Agent
from livekit.plugins import openai


# Define the view_analytics tool for testing
async def view_analytics(
    period: Annotated[str, "Time period: today, week, month, 2months, year, or all"],
):
    """Get sales analytics and insights. Use when user asks about sales, revenue, profit, or performance."""
    # This is a stub - will be mocked in tests
    return f"Analytics for {period}: Revenue: $0, Profit: $0, Sales: 0, Profit margin: 0%"


# Create a simple Agent for testing (extending from base Agent class)
class InventoryAssistant(Agent):
    def __init__(self):
        super().__init__(
            instructions="""You are a helpful AI assistant for a textile inventory management system. 
            
            You can view sales analytics and profit statistics for different time periods.
            
            Be conversational, friendly, and efficient. When the user asks about sales:
            1. Understand which time period they're asking about (today, week, month, year)
            2. Use the view_analytics tool with the appropriate period parameter
            3. Provide a clear, human-friendly response with the sales data
            
            When providing sales information, mention the revenue, profit, number of sales, and profit margin.""",
            tools=[view_analytics]
        )


@pytest.mark.skip(reason="AgentSession.run() and mock_tools() not available in livekit-agents 1.2.15")
@pytest.mark.asyncio
async def test_current_month_sales():
    """
    Test that the agent correctly responds to "What is current month sales?"
    
    This test verifies:
    1. Tool usage: The agent should call view_analytics with period="month"
    2. Expected behavior: The agent should provide sales information in a friendly manner
    
    NOTE: This test uses APIs (mock_tools, session.run) that are not available in
    livekit-agents 1.2.15. See test_analytics_tool.py for working tests using
    direct tool invocation approach.
    """
    pass


if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "-s"])

