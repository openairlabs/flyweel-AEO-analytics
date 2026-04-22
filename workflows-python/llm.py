"""LLM provider client utilities."""

import json
import os
import time

from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from utils import log


def ping_provider(provider: str, model: str, prompt: str) -> dict:
    """Ping an LLM provider with a prompt and return the response.

    Args:
        provider: One of "openai", "anthropic", "google"
        model: The model name to use
        prompt: The prompt to send

    Returns:
        dict with keys: content, latencyMs, tokenCount, webSearchUsed
    """
    start_time = time.time()
    log(f"[ping-llm] Starting: provider={provider}, model={model}")
    web_search_used = False

    if provider == "openai":
        llm = ChatOpenAI(
            model=model,
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
        # OpenAI web search using Responses API (per LangChain docs)
        tool = {"type": "web_search_preview"}
        llm_with_tools = llm.bind_tools([tool])
        response = llm_with_tools.invoke(prompt)

        # Debug logging
        log(
            f"[{provider}] additional_kwargs: {json.dumps(getattr(response, 'additional_kwargs', {}), default=str)[:500]}"
        )
        log(f"[{provider}] content type: {type(response.content)}")
        if isinstance(response.content, list):
            log(
                f"[{provider}] content blocks: {[p.get('type') if isinstance(p, dict) else type(p).__name__ for p in response.content[:5]]}"
            )

        # Check for web search usage in content blocks
        if isinstance(response.content, list):
            for part in response.content:
                if (
                    isinstance(part, dict)
                    and part.get("type") == "server_tool_call"
                    and part.get("name") == "web_search"
                ):
                    web_search_used = True
                    break

    elif provider == "anthropic":
        llm = ChatAnthropic(
            model=model,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            temperature=1,
        )
        # Anthropic web search tool (if available)
        try:
            response = llm.invoke(
                prompt, tools=[{"type": "web_search_20250305", "name": "web_search"}]
            )

            # Debug logging
            log(f"[{provider}] content type: {type(response.content)}")
            if isinstance(response.content, list):
                log(
                    f"[{provider}] content parts: {[type(p).__name__ for p in response.content[:5]]}"
                )

            # Check if web search was used
            if isinstance(response.content, list):
                for part in response.content:
                    if isinstance(part, dict) and part.get("type") in [
                        "web_search_tool_result",
                        "server_tool_use",
                    ]:
                        web_search_used = True
                        break
        except Exception as e:
            log(f"[{provider}] web search error: {e}")
            # Fall back to no web search if not supported
            response = llm.invoke(prompt)

    elif provider == "google":
        llm = ChatGoogleGenerativeAI(
            model=model,
            api_key=os.environ.get("GOOGLE_API_KEY"),
        )
        # Google Search grounding (per LangChain docs)
        try:
            llm_with_search = llm.bind_tools([{"google_search": {}}])
            response = llm_with_search.invoke(prompt)

            # Debug logging
            log(f"[{provider}] content type: {type(response.content)}")
            if isinstance(response.content, list):
                log(
                    f"[{provider}] content blocks: {[p.get('type') if isinstance(p, dict) else type(p).__name__ for p in response.content[:5]]}"
                )

            # Check for citations in content blocks (indicates search was used)
            if isinstance(response.content, list):
                for part in response.content:
                    if isinstance(part, dict):
                        # Check for server_tool_call with google_search
                        if (
                            part.get("type") == "server_tool_call"
                            and part.get("name") == "google_search"
                        ):
                            web_search_used = True
                            break
                        # Check for annotations with citations
                        annotations = part.get("annotations", [])
                        if any(
                            a.get("type") == "citation"
                            for a in annotations
                            if isinstance(a, dict)
                        ):
                            web_search_used = True
                            break
        except Exception as e:
            log(f"[{provider}] web search error: {e}")
            # Fall back to no web search if not supported
            response = llm.invoke(prompt)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    latency_ms = int((time.time() - start_time) * 1000)

    # Handle content that might be an array (Gemini) or string
    if isinstance(response.content, str):
        content = response.content
    elif isinstance(response.content, list):
        parts = []
        for part in response.content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
            elif hasattr(part, "text"):
                parts.append(part.text)
            else:
                parts.append(str(part))
        content = "".join(parts)
    else:
        content = str(response.content)

    log(
        f"[ping-llm] Done: provider={provider}, webSearchUsed={web_search_used}, latency={latency_ms}ms"
    )

    return {
        "content": content,
        "latencyMs": latency_ms,
        "tokenCount": getattr(response, "usage_metadata", {}).get("total_tokens"),
        "webSearchUsed": web_search_used,
    }
