/**
 * LLM provider client utilities.
 */

import { ChatAnthropic, tools as anthropicTools } from "@langchain/anthropic";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

export interface PingOutput {
  content: string;
  latencyMs: number;
  tokenCount?: number;
  webSearchUsed?: boolean;
}

/**
 * Ping an LLM provider with a prompt and return the response.
 */
export async function pingProvider(
  provider: "openai" | "anthropic" | "google",
  model: string,
  prompt: string,
): Promise<PingOutput> {
  console.log(`[ping-llm] Starting: provider=${provider}, model=${model}`);
  const startTime = Date.now();

  let response: AIMessageChunk;

  switch (provider) {
    case "openai": {
      const llm = new ChatOpenAI({
        model,
        apiKey: process.env.OPENAI_API_KEY,
      });
      // Web search tool using Responses API format (per Python docs pattern)
      const webSearchTool = { type: "web_search_preview" };
      const llmWithSearch = llm.bindTools([webSearchTool]);
      response = await llmWithSearch.invoke(prompt);
      break;
    }
    case "anthropic": {
      const llm = new ChatAnthropic({
        model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: 1,
      });
      // Bind web search tool and invoke
      response = await llm.invoke(prompt, {
        tools: [anthropicTools.webSearch_20250305()],
      });
      break;
    }
    case "google": {
      const llm = new ChatGoogleGenerativeAI({
        model,
        apiKey: process.env.GOOGLE_API_KEY,
      });
      // Google Search grounding tool (snake_case per API error message)
      const searchTool = { google_search: {} };
      const llmWithSearch = llm.bindTools([searchTool]);
      response = await llmWithSearch.invoke(prompt);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  // Handle content that might be an array (Gemini) or string
  let content: string;
  if (typeof response.content === "string") {
    content = response.content;
  } else if (Array.isArray(response.content)) {
    content = response.content
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("");
  } else {
    content = String(response.content);
  }

  // Detect if web search was used
  let webSearchUsed = false;

  // Debug: log response metadata for detection debugging
  console.log(`[${provider}] Checking web search usage...`);
  console.log(
    `[${provider}] tool_calls:`,
    JSON.stringify(response.tool_calls?.slice(0, 2)),
  );
  console.log(
    `[${provider}] additional_kwargs keys:`,
    Object.keys(response.additional_kwargs || {}),
  );
  if (provider === "google") {
    console.log(
      `[${provider}] response_metadata keys:`,
      Object.keys(response.response_metadata || {}),
    );
  }

  if (provider === "openai") {
    // OpenAI: Check multiple places for web search evidence
    const additionalKwargs = response.additional_kwargs as Record<
      string,
      unknown
    >;

    // Log everything for debugging
    console.log(
      `[${provider}] additional_kwargs:`,
      JSON.stringify(additionalKwargs, null, 2).substring(0, 500),
    );
    console.log(
      `[${provider}] content type:`,
      typeof response.content,
      Array.isArray(response.content) ? "array" : "",
    );
    if (Array.isArray(response.content)) {
      console.log(
        `[${provider}] content blocks:`,
        JSON.stringify(
          response.content.slice(0, 3).map((c) =>
            typeof c === "object" && c !== null
              ? {
                  type: (c as Record<string, unknown>).type,
                  name: (c as Record<string, unknown>).name,
                  hasAnnotations: !!(c as Record<string, unknown>).annotations,
                  annotationCount: (
                    (c as Record<string, unknown>).annotations as
                      | unknown[]
                      | undefined
                  )?.length,
                }
              : typeof c,
          ),
        ),
      );
    }

    // Check content blocks for server_tool_call OR annotations with citations
    if (Array.isArray(response.content)) {
      for (const part of response.content) {
        if (typeof part === "object" && part !== null) {
          const p = part as Record<string, unknown>;
          // Check for server_tool_call
          if (p.type === "server_tool_call" && p.name === "web_search") {
            webSearchUsed = true;
            break;
          }
          // Check for annotations in text blocks (citations from web search)
          const annotations = p.annotations as
            | Array<{ type?: string; url?: string }>
            | undefined;
          if (
            annotations?.some(
              (a) =>
                a.type === "url_citation" || a.type === "citation" || a.url,
            )
          ) {
            webSearchUsed = true;
            break;
          }
        }
      }
    }

    // Also check tool_outputs for web_search_call (per OpenAI docs)
    if (!webSearchUsed) {
      const toolOutputs = additionalKwargs?.tool_outputs as
        | Array<{ type?: string }>
        | undefined;
      if (toolOutputs?.some((t) => t.type === "web_search_call")) {
        webSearchUsed = true;
      }
    }

    // Check tool_calls for web_search name
    if (!webSearchUsed && response.tool_calls?.length) {
      webSearchUsed = response.tool_calls.some((tc) => tc.name === "web_search");
    }

    // Check annotations for url_citation
    if (!webSearchUsed && additionalKwargs) {
      const annotations = additionalKwargs.annotations as
        | Array<{ type?: string }>
        | undefined;
      if (annotations?.some((a) => a.type === "url_citation")) {
        webSearchUsed = true;
      }
    }
  } else if (provider === "anthropic") {
    // Anthropic: Check for web_search_tool_result in content
    if (Array.isArray(response.content)) {
      webSearchUsed = response.content.some(
        (part) =>
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          (part.type === "web_search_tool_result" ||
            part.type === "server_tool_use"),
      );
    }
  } else if (provider === "google") {
    // Google: Check for groundingMetadata in response_metadata
    const metadata = response.response_metadata as Record<string, unknown>;

    // Log everything for debugging
    console.log(
      `[${provider}] response_metadata:`,
      JSON.stringify(metadata, null, 2).substring(0, 1000),
    );
    console.log(
      `[${provider}] content type:`,
      typeof response.content,
      Array.isArray(response.content) ? "array" : "",
    );
    if (Array.isArray(response.content)) {
      console.log(
        `[${provider}] content blocks:`,
        JSON.stringify(
          response.content.slice(0, 3).map((c) =>
            typeof c === "object" && c !== null
              ? {
                  type: (c as Record<string, unknown>).type,
                  name: (c as Record<string, unknown>).name,
                }
              : typeof c,
          ),
        ),
      );
    }

    // Check content blocks for server_tool_call with google_search or annotations with citations
    if (Array.isArray(response.content)) {
      for (const part of response.content) {
        if (typeof part === "object" && part !== null) {
          const p = part as Record<string, unknown>;
          // Check for server_tool_call
          if (p.type === "server_tool_call" && p.name === "google_search") {
            webSearchUsed = true;
            break;
          }
          // Check for annotations with citations
          const annotations = p.annotations as
            | Array<{ type?: string }>
            | undefined;
          if (annotations?.some((a) => a.type === "citation")) {
            webSearchUsed = true;
            break;
          }
        }
      }
    }

    // Also check groundingMetadata
    if (!webSearchUsed) {
      const groundingMeta = metadata?.groundingMetadata as
        | {
            groundingChunks?: unknown[];
            webSearchQueries?: string[];
          }
        | undefined;
      webSearchUsed =
        !!groundingMeta?.groundingChunks?.length ||
        !!groundingMeta?.webSearchQueries?.length;

      console.log(
        `[${provider}] groundingMetadata:`,
        groundingMeta ? "present" : "absent",
      );
    }
  }

  console.log(
    `[ping-llm] Done: provider=${provider}, webSearchUsed=${webSearchUsed}, latency=${Date.now() - startTime}ms`,
  );

  return {
    content,
    latencyMs: Date.now() - startTime,
    tokenCount: response.usage_metadata?.total_tokens,
    webSearchUsed,
  };
}
