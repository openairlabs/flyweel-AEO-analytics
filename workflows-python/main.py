"""
Workflow Tasks
Defines Render Workflow tasks for AEO Analytics.
"""

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timedelta

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from psycopg2.extras import RealDictCursor
from render_sdk import Retry, Workflows

from db import get_db_connection
from llm import ping_provider
from utils import extract_urls, log, match_url_to_brand

load_dotenv()

CONCURRENCY = 10
TASK_TIMEOUT_SECONDS = 5 * 60  # 5 minutes

# Initialize the Workflows app
app = Workflows(
    default_retry=Retry(max_retries=1, wait_duration_ms=2000, backoff_scaling=1.5),
    default_timeout=TASK_TIMEOUT_SECONDS,
)


# ============ PING LLM TASK ============


@app.task(name="ping-llm")
async def ping_llm(provider: str, model: str, prompt: str) -> dict:
    """Ping an LLM with a prompt and return the response."""
    return ping_provider(provider, model, prompt)


# ============ ANALYZE RESPONSE TASK ============


@app.task(name="analyze-response")
async def analyze_response(response_id: str) -> dict:
    """Analyze an LLM response for brand mentions and links."""
    log(f"Starting analyze-response task for responseId: {response_id}")

    # Fetch response content from DB
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT content FROM responses WHERE id = %s", (response_id,))
            response_row = cur.fetchone()

            if not response_row:
                raise ValueError(f"Response not found: {response_id}")

            response_content = response_row["content"]
            log(f"Response content length: {len(response_content)}")

            # Fetch active brands from DB (including domains for URL matching)
            cur.execute("SELECT id, name, domains FROM brands WHERE is_active = true")
            brand_rows = cur.fetchall()
            brand_names = [row["name"] for row in brand_rows]
            log(f"Brand names: {brand_names}")
    finally:
        conn.close()

    # Extract URLs from response content
    extracted_urls = extract_urls(response_content)
    log(f"Extracted URLs: {len(extracted_urls)}")

    # Match URLs to brands
    links = []
    for url_data in extracted_urls:
        matched_brand = match_url_to_brand(url_data["url"], brand_rows)
        links.append(
            {**url_data, "brandName": matched_brand["name"] if matched_brand else None}
        )

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ValueError("ANTHROPIC_API_KEY is not set")

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
    )

    log("Calling Claude for analysis...")
    response = llm.invoke(
        f"""Analyze this LLM response for mentions of these platforms: {", ".join(brand_names)}

For each mentioned platform, determine:
1. Sentiment (positive, negative, or neutral) - based on how the platform is described
2. Ranking position if platforms are compared or listed (1 = first/best mentioned, null if not ranked)
3. The exact context/excerpt where it's mentioned (keep it concise, max 200 chars)

Only include platforms that are actually mentioned in the response.

Provide a brief summary (1-2 sentences) of the overall response.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{{"summary": "your summary", "mentions": [{{"brandName": "Name", "sentiment": "positive", "ranking": 1, "context": "excerpt"}}]}}

Response to analyze:
{response_content}"""
    )

    log("Claude response received")

    content = response.content
    json_match = re.search(r"\{[\s\S]*\}", content)
    if not json_match:
        log(f"Failed to extract JSON from: {content}")
        raise ValueError("Failed to parse JSON from response")

    result = json.loads(json_match.group(0))
    log(f"Parsed result: {result}")
    log(f"Links found: {len(links)}")

    return {
        "summary": result.get("summary", ""),
        "mentions": result.get("mentions", []),
        "links": links,
    }


# ============ GENERATE DIGEST TASK ============


@app.task(name="generate-digest")
async def generate_digest() -> dict:
    """Generate an AI-powered insights digest."""
    log("Starting generate-digest task...")

    # Fetch all data from DB
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch all mentions with related data
            cur.execute(
                """
                SELECT 
                    bm.sentiment,
                    bm.ranking,
                    b.name as brand_name,
                    b.is_own_brand,
                    p.name as provider_name,
                    p.model as provider_model,
                    a.created_at
                FROM brand_mentions bm
                JOIN brands b ON bm.brand_id = b.id
                JOIN analyses a ON bm.analysis_id = a.id
                JOIN responses r ON a.response_id = r.id
                JOIN providers p ON r.provider_id = p.id
            """
            )
            all_mentions = cur.fetchall()

            # Fetch active brands
            cur.execute("SELECT name, is_own_brand FROM brands WHERE is_active = true")
            all_brands = cur.fetchall()
    finally:
        conn.close()

    own_brand = next((b for b in all_brands if b["is_own_brand"]), None)

    if not own_brand:
        return {
            "digest": "No own brand configured. Set up your brand in Settings to see insights."
        }

    if len(all_mentions) == 0:
        return {
            "digest": "No data yet. Run some prompts and analyze responses to generate insights."
        }

    # Aggregate data instead of sending raw mentions (to avoid token limits)
    brand_stats = {}
    provider_stats = {}

    for m in all_mentions:
        brand = m["brand_name"]
        provider = m["provider_name"]

        # Brand aggregation
        if brand not in brand_stats:
            brand_stats[brand] = {
                "mentions": 0,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "rankings": [],
                "isOwnBrand": m["is_own_brand"],
            }
        brand_stats[brand]["mentions"] += 1
        brand_stats[brand][m["sentiment"]] += 1
        if m["ranking"]:
            brand_stats[brand]["rankings"].append(m["ranking"])

        # Provider aggregation for own brand
        if m["is_own_brand"]:
            if provider not in provider_stats:
                provider_stats[provider] = {
                    "mentions": 0,
                    "positive": 0,
                    "negative": 0,
                    "neutral": 0,
                    "rankings": [],
                }
            provider_stats[provider]["mentions"] += 1
            provider_stats[provider][m["sentiment"]] += 1
            if m["ranking"]:
                provider_stats[provider]["rankings"].append(m["ranking"])

    # Calculate averages
    for stats in brand_stats.values():
        stats["avgRanking"] = (
            round(sum(stats["rankings"]) / len(stats["rankings"]), 1)
            if stats["rankings"]
            else None
        )
        del stats["rankings"]

    for stats in provider_stats.values():
        stats["avgRanking"] = (
            round(sum(stats["rankings"]) / len(stats["rankings"]), 1)
            if stats["rankings"]
            else None
        )
        del stats["rankings"]

    brand_list = [
        {"name": b["name"], "isOwnBrand": b["is_own_brand"]} for b in all_brands
    ]
    competitors = [b["name"] for b in brand_list if not b["isOwnBrand"]]

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ValueError("ANTHROPIC_API_KEY is not set")

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
    )

    log("Calling Claude for digest generation...")
    response = llm.invoke(
        f"""You are analyzing competitive intelligence data about how LLMs mention and position different brands.

Your brand: {own_brand["name"]}
Competitors: {", ".join(competitors)}

Aggregated brand statistics (mentions, sentiment counts, avg ranking):
{json.dumps(brand_stats, indent=2)}

How {own_brand["name"]} performs by LLM provider:
{json.dumps(provider_stats, indent=2)}

Generate a concise 4-5 line digest summarizing the key insights. Focus on:
- How {own_brand["name"]} is positioned vs competitors (average ranking)
- Sentiment trends (are LLMs positive/negative about {own_brand["name"]}?)
- Which LLM providers favor or disfavor {own_brand["name"]}
- Any notable patterns or concerns

Use markdown formatting. Be direct and actionable. Start with the most important insight.
Do NOT include a title/header - just the content."""
    )

    digest = response.content
    log(f"Digest generated: {digest}")

    return {"digest": digest}


# ============ PING ALL TASK ============


@app.task(name="ping-all")
async def ping_all() -> dict:
    """Ping all active prompts with all active providers."""
    log("Starting ping-all task...")

    # Get today's date range for deduplication
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch active prompts
            cur.execute("SELECT id, content FROM prompts WHERE is_active = true")
            active_prompts = cur.fetchall()

            # Fetch active providers
            cur.execute("SELECT id, name, model FROM providers WHERE is_active = true")
            active_providers = cur.fetchall()

            # Fetch already-pinged combinations today
            cur.execute(
                """SELECT prompt_id, provider_id FROM responses 
                   WHERE created_at >= %s AND created_at < %s""",
                (today, tomorrow),
            )
            already_pinged = {
                (r["prompt_id"], r["provider_id"]) for r in cur.fetchall()
            }
    finally:
        conn.close()

    log(f"Found {len(active_prompts)} prompts and {len(active_providers)} providers")

    # Build list of tasks, filtering out already-pinged
    tasks_to_run = []
    skipped = 0
    for prompt in active_prompts:
        for provider in active_providers:
            if (prompt["id"], provider["id"]) in already_pinged:
                skipped += 1
            else:
                tasks_to_run.append({"prompt": prompt, "provider": provider})

    log(f"Skipping {skipped} already-pinged, running {len(tasks_to_run)} new pings")

    # Semaphore for concurrency limiting
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def process_one(prompt, provider):
        """Process a single ping and save result to DB."""
        async with semaphore:
            try:
                log(
                    f"Spawning ping for {provider['name']} ({provider['model']}) prompt {prompt['id']}"
                )
                result = await ping_llm(
                    provider["name"], provider["model"], prompt["content"]
                )

                # Save response to DB
                conn = get_db_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """INSERT INTO responses (id, prompt_id, provider_id, content, latency_ms, token_count, web_search_used, created_at)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
                            (
                                str(uuid.uuid4()),
                                prompt["id"],
                                provider["id"],
                                result["content"],
                                result["latencyMs"],
                                result.get("tokenCount"),
                                result.get("webSearchUsed", False),
                            ),
                        )
                        conn.commit()
                finally:
                    conn.close()

                log(f"Pinged {provider['name']} for prompt {prompt['id']} successfully")
                return "pinged"
            except Exception as e:
                log(f"Failed to ping {provider['name']}: {e}")
                return "failed"

    # Spawn all subtasks in parallel using asyncio.gather
    results = await asyncio.gather(
        *[process_one(t["prompt"], t["provider"]) for t in tasks_to_run],
        return_exceptions=True,
    )

    pinged = sum(1 for r in results if r == "pinged")
    failed = sum(1 for r in results if r != "pinged")

    log(f"Ping-all complete: {pinged} pinged, {skipped} skipped, {failed} failed")
    return {"pinged": pinged, "skipped": skipped, "failed": failed}


# ============ ANALYZE ALL TASK ============


@app.task(name="analyze-all")
async def analyze_all() -> dict:
    """Analyze all unanalyzed responses."""
    log("Starting analyze-all task...")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find unanalyzed responses
            cur.execute(
                """SELECT r.id FROM responses r
                   LEFT JOIN analyses a ON r.id = a.response_id
                   WHERE a.id IS NULL"""
            )
            unanalyzed = cur.fetchall()

            # Fetch active brands
            cur.execute("SELECT id, name FROM brands WHERE is_active = true")
            active_brands = cur.fetchall()
    finally:
        conn.close()

    log(f"Found {len(unanalyzed)} unanalyzed responses")

    # Semaphore for concurrency limiting
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async def process_one(response):
        """Process a single response analysis."""
        async with semaphore:
            try:
                log(f"Analyzing response {response['id']}...")
                result = await analyze_response(response["id"])

                conn = get_db_connection()
                try:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        # Save analysis
                        analysis_id = str(uuid.uuid4())
                        cur.execute(
                            """INSERT INTO analyses (id, response_id, summary, created_at)
                               VALUES (%s, %s, %s, NOW()) RETURNING id""",
                            (analysis_id, response["id"], result["summary"]),
                        )

                        # Save mentions
                        for mention in result.get("mentions", []):
                            brand = next(
                                (
                                    b
                                    for b in active_brands
                                    if b["name"] == mention["brandName"]
                                ),
                                None,
                            )
                            if brand:
                                cur.execute(
                                    """INSERT INTO brand_mentions (id, analysis_id, brand_id, sentiment, ranking, context)
                                       VALUES (%s, %s, %s, %s, %s, %s)""",
                                    (
                                        str(uuid.uuid4()),
                                        analysis_id,
                                        brand["id"],
                                        mention["sentiment"],
                                        mention.get("ranking"),
                                        mention.get("context"),
                                    ),
                                )

                        # Save links
                        for link in result.get("links", []):
                            brand = next(
                                (
                                    b
                                    for b in active_brands
                                    if b["name"] == link.get("brandName")
                                ),
                                None,
                            )
                            cur.execute(
                                """INSERT INTO brand_links (id, analysis_id, brand_id, url, link_text, is_markdown_link)
                                   VALUES (%s, %s, %s, %s, %s, %s)""",
                                (
                                    str(uuid.uuid4()),
                                    analysis_id,
                                    brand["id"] if brand else None,
                                    link["url"],
                                    link.get("linkText"),
                                    link.get("isMarkdownLink", False),
                                ),
                            )

                        conn.commit()
                    log(f"Analyzed response {response['id']} successfully")
                    return "analyzed"
                finally:
                    conn.close()
            except Exception as e:
                log(f"Failed to analyze response {response['id']}: {e}")
                return "failed"

    # Spawn all analysis subtasks in parallel
    results = await asyncio.gather(
        *[process_one(r) for r in unanalyzed],
        return_exceptions=True,
    )

    analyzed = sum(1 for r in results if r == "analyzed")
    failed = sum(1 for r in results if r != "analyzed")

    log(f"Analyze-all complete: {analyzed} analyzed, {failed} failed")
    return {"analyzed": analyzed, "failed": failed}


# ============ DAILY JOB TASK ============


@app.task(name="daily-job")
async def daily_job() -> dict:
    """Run the daily job: ping all, analyze all, generate digest."""
    log("[daily-job] Starting...")

    # Step 1: Ping all - call task function directly (subtask pattern)
    log("[daily-job] Step 1: Starting ping-all...")
    ping_result = await ping_all()
    log(
        f"[daily-job] Step 1: ping-all COMPLETE: {ping_result['pinged']} pinged, {ping_result['skipped']} skipped, {ping_result['failed']} failed"
    )

    # Step 2: Analyze all (only after ping completes)
    log("[daily-job] Step 2: Starting analyze-all...")
    analyze_result = await analyze_all()
    log(
        f"[daily-job] Step 2: analyze-all COMPLETE: {analyze_result['analyzed']} analyzed, {analyze_result['failed']} failed"
    )

    # Step 3: Generate digest (only after analyze completes)
    digest_generated = False
    try:
        log("[daily-job] Step 3: Starting generate-digest...")
        digest_result = await generate_digest()

        if digest_result and digest_result.get("digest"):
            # Save digest to DB
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO digests (id, content, created_at) VALUES (%s, %s, NOW())",
                        (str(uuid.uuid4()), digest_result["digest"]),
                    )
                    conn.commit()
            finally:
                conn.close()

            digest_generated = True
            log("[daily-job] Step 3: generate-digest COMPLETE - saved to DB")
        else:
            log("[daily-job] Step 3: generate-digest COMPLETE - no digest content")
    except Exception as e:
        log(f"[daily-job] Step 3: generate-digest FAILED: {e}")

    log("[daily-job] All steps complete!")
    return {
        "ping": ping_result,
        "analyze": analyze_result,
        "digestGenerated": digest_generated,
    }


if __name__ == "__main__":
    app.start()
