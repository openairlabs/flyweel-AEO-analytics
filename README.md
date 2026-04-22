# AEO Analytics

Answer Engine Optimization analytics: track how LLMs mention and position your brand vs competitors.

## Features

- **Multi-LLM support**: Query OpenAI, Anthropic, and Google models in parallel
- **Competitive analysis**: LLM-powered analysis extracts brand mentions, sentiment, and rankings
- **Link tracking**: Detect and attribute URLs in LLM responses to tracked brands
- **Insights dashboard**: Visualize mention frequency, sentiment distribution, and rankings over time

## Use as a template

This project is a template for building your own AEO analytics dashboard. Use it to track how AI models mention your brand, product, or company compared to competitors.

### Create your repository

1. Click **Use this template** at the top of this repository.
1. Name your new repository and set visibility.
1. Clone your new repository locally.

### Customize for your brand

Edit [`web/src/db/seed.dev.ts`](web/src/db/seed.dev.ts) to configure your industry, brands, and prompts.

#### 1. Set your industry

```typescript
await db.insert(industries).values({
  id: industryId,
  name: "Your Industry",  // e.g., "Cloud Storage", "CRM Software", "Design Tools"
  description: "Description of your industry",
});
```

#### 2. Configure your brands

Replace the demo brands with your own. Set `isOwnBrand: true` for your brand:

```typescript
const brandData = [
  {
    name: "YourBrand",
    aliases: ["yourbrand.com", "YourBrand.com"],
    domains: ["yourbrand.com", "docs.yourbrand.com"],
    isOwnBrand: true,  // This is YOUR brand
  },
  {
    name: "Competitor1",
    aliases: ["competitor1.com"],
    domains: ["competitor1.com"],
    isOwnBrand: false,
  },
  {
    name: "Competitor2",
    aliases: ["competitor2.com"],
    domains: ["competitor2.com"],
    isOwnBrand: false,
  },
  // Add more competitors...
];
```

The `domains` array is used to match URLs in LLM responses back to brands.

#### 3. Write your prompts

Create prompts that potential customers might ask AI assistants about your industry:

```typescript
const samplePrompts = [
  {
    name: "Best solution 2026",
    content: "What is the best [your category] solution in 2026?",
  },
  {
    name: "Comparison",
    content: "Compare the top [your category] tools for small businesses.",
  },
  {
    name: "Alternative to competitor",
    content: "What are the best alternatives to [top competitor]?",
  },
  {
    name: "Recommendation",
    content: "Which [your category] tool would you recommend for [use case]?",
  },
  // Add 5-10 prompts that cover different angles
];
```

Tips for effective prompts:

- Include recency terms ("in 2026", "currently", "latest") to get up-to-date responses
- Ask comparison questions that naturally invite multiple brand mentions
- Cover different user intents: research, comparison, recommendation, alternatives
- Avoid prompts that only mention one or two specific brands

### Deploy to Render

1. Push your customized code to your repository.

1. Go to the [Render Dashboard](https://dashboard.render.com) and create a new **Blueprint**.

1. Connect your repository and select the branch to deploy.

1. Set the required environment variables:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Automatically set by Render PostgreSQL |
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `GOOGLE_API_KEY` | Your Google AI API key |

1. Deploy the Blueprint.

1. Run the database seed to create your initial configuration:

   ```bash
   pnpm db:seed:dev
   ```

1. Set up a [Render Workflow](https://docs.render.com/workflows) to run the `daily-job` task on a schedule (e.g., daily at 9am).

### Start collecting data

Once deployed, the workflow:

1. **Pings all LLMs** with your configured prompts
1. **Analyzes responses** for brand mentions, sentiment, and rankings
1. **Generates a digest** summarizing insights about your brand's AI visibility

View results in the dashboard. Data accumulates over time, showing trends in how AI models perceive and recommend your brand.

## Demo data

The default seed tracks a fictional brand called **SprintHub** competing against real developer tools:

| Brand | Type |
|-------|------|
| SprintHub | Own brand (fictional) |
| GitHub | Competitor |
| GitLab | Competitor |
| Linear | Competitor |
| Jira | Competitor |
| Notion | Competitor |
| Bitbucket | Competitor |

This demonstrates the dashboard with a realistic competitive landscape. Replace this with your own configuration when using as a template.

## Tech stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with Drizzle ORM
- **LLM SDK**: LangChain
- **Workflows**: Render Workflows SDK

## Project structure

```
├── web/                    # Next.js application
│   └── src/db/
│       ├── schema.ts       # Database schema
│       ├── seed.ts         # Production seed (providers only)
│       └── seed.dev.ts     # Dev seed (industry, brands, prompts)
├── workflows/              # TypeScript workflow tasks
│   ├── index.ts            # Task definitions
│   ├── llm.ts              # LLM provider logic
│   ├── utils.ts            # URL extraction, brand matching
│   └── db/                 # Database client
├── workflows-python/       # Python workflow tasks (alternative)
│   ├── main.py             # Task definitions
│   ├── llm.py              # LLM provider logic
│   ├── utils.py            # URL extraction, brand matching
│   └── db.py               # Database connection
├── render.yaml             # Render Blueprint
└── pnpm-workspace.yaml
```

## Local development

### Prerequisites

- Node.js 20+
- pnpm
- Docker (optional, for local PostgreSQL)

### Environment variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Required keys:

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: For GPT models
- `ANTHROPIC_API_KEY`: For Claude models
- `GOOGLE_API_KEY`: For Gemini models

### Run locally

Start the database and run the app:

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
pnpm install

# Set up database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/citations_tracker pnpm db:push
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/citations_tracker pnpm db:seed:dev

# Start dev server
pnpm dev
```

The dev seed creates the SprintHub demo configuration. To populate real data, run the workflows.

### Without Docker

1. Install dependencies:

   ```bash
   pnpm install
   ```

1. Set up PostgreSQL and update `DATABASE_URL` in `.env`.

1. Run migrations and seed:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed:dev
   ```

1. Start development:

   ```bash
   pnpm dev
   ```
