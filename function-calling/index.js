import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";

// 1. Initialize the Gemini client (it automatically picks up GEMINI_API_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Define the actual JavaScript function that does the real work
function getStockPrice(ticker) {
  const mockDatabase = {
    GOOG: 175.5,
    AAPL: 180.25,
    MSFT: 420.1,
  };

  const stock = ticker.toUpperCase();
  if (stock in mockDatabase) {
    return { price: mockDatabase[stock], currency: "USD" };
  }
  return { error: `Ticker ${ticker} not found.` };
}

async function main() {
  // 3. Describe the function to Gemini so it knows how and when to use it
  const stockPriceDeclaration = {
    name: "getStockPrice",
    description:
      "Retrieves the current live stock price for a given ticker symbol.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticker: {
          type: Type.STRING,
          description: "The stock ticker symbol (e.g., GOOG, AAPL)",
        },
      },
      required: ["ticker"],
    },
  };

  // 4. Pass the tool definition to the model along with the user's prompt
  const userPrompt = "How much is one share of Apple stock right now?";

  console.log(`User: ${userPrompt}`);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: {
      // We hand the tool definition to the model here
      tools: [{ functionDeclarations: [stockPriceDeclaration] }],
    },
  });

  // 5. Check if the model decided it needs to call the function
  const functionCalls = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    console.log(`\n🤖 Gemini requested function: ${call.name}`);
    console.log(`🤖 Arguments provided by Gemini:`, call.args);

    // 6. Execute your local JavaScript function using the arguments Gemini gave you
    let functionResult;
    if (call.name === "getStockPrice") {
      functionResult = getStockPrice(call.args.ticker);
    }

    console.log(`\n💻 Your App executed function. Result:`, functionResult);

    // 7. Send the result back to Gemini so it can formulate the final text answer
    const finalResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      // We must provide the entire conversation history back to the model
      contents: [
        { role: "user", parts: [{ text: userPrompt }] },
        response.candidates[0].content, // The model's function call request
        {
          role: "tool",
          parts: [
            {
              functionResponse: {
                name: "getStockPrice",
                response: { result: functionResult },
              },
            },
          ],
        },
      ],
      // Keep the tools config in the final call just in case it wants to call another tool
      config: { tools: [{ functionDeclarations: [stockPriceDeclaration] }] },
    });

    console.log(`\n🤖 Gemini's final answer: ${finalResponse.text}`);
  } else {
    // If the user asked something simple like "Hi", Gemini won't call a function
    console.log(`🤖 Gemini: ${response.text}`);
  }
}

main().catch(console.error);
