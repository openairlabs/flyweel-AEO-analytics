import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
const AnalyzeOutputSchema = z.object({
    summary: z.string(),
    mentions: z.array(z.object({
        brandName: z.string(),
        sentiment: z.enum(["positive", "negative", "neutral"]),
        ranking: z.number().nullable(),
        context: z.string(),
    })),
});
async function test() {
    const input = {
        responseContent: "Render is great for deploying apps. Vercel is best for Next.js. Railway is also good.",
        brandNames: ["Render", "Vercel", "Railway", "Fly.io", "Heroku"],
    };
    console.log("Starting test...");
    console.log("Brand names:", input.brandNames);
    console.log("Response content length:", input.responseContent.length);
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    const maxContentLength = 8000;
    const contentToAnalyze = input.responseContent.length > maxContentLength
        ? `${input.responseContent.slice(0, maxContentLength)}...`
        : input.responseContent;
    const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("Creating structured model...");
    const structuredModel = model.withStructuredOutput(AnalyzeOutputSchema, {
        name: "analysis",
        method: "json_schema",
        strict: true,
    });
    console.log("Calling OpenAI...");
    const result = await structuredModel.invoke(`
You are an expert analyst. Analyze this LLM response for mentions of these platforms: ${input.brandNames.join(", ")}

For each mentioned platform, determine:
1. Sentiment (positive, negative, or neutral) - based on how the platform is described
2. Ranking position if platforms are compared or listed (1 = first/best mentioned, null if not ranked)
3. The exact context/excerpt where it's mentioned (keep it concise, max 200 chars)

Only include platforms that are actually mentioned in the response. If a platform is not mentioned, do not include it.

Provide a brief summary (1-2 sentences) of the overall response and how it positions the platforms.

Response to analyze:
${contentToAnalyze}
  `);
    console.log("Result:", JSON.stringify(result, null, 2));
}
test().catch(console.error);
