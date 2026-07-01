## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, tailwindcss, drizzle

---

# AGENTS.md

# MOONDAY Project Instructions

## Project Name

**MOONDAY**

Full backronym:

**Mindful Optimist Onboard Navigator Developed Around You**

Product concept:

MOONDAY is a personal AI daily companion focused on emotional reflection, memory, mood awareness, and lightweight voice interaction. It is not designed as a clinical therapist or medical tool. It should help the user understand feelings, organize thoughts, reflect on daily life, and build a personal memory layer over time.

The product should feel warm, animated, personal, slightly witty, and emotionally aware.

---

## Primary Goal

Build the first private MVP of MOONDAY using:

- SvelteKit
- Svelte
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- pgvector
- Bun for local development
- DeepSeek API and Claude API through an abstraction layer
- Web Speech API for initial speech-to-text and text-to-speech

The MVP must prioritize:

1. A beautiful animated chat interface.
2. A clear MOONDAY persona.
3. Persistent conversation history.
4. Mood check-ins.
5. Basic emotional reflection.
6. Memory extraction and recall.
7. Provider abstraction for multiple LLMs.
8. Browser-native voice input/output using Web Speech API.
9. A database structure that can later support long-term memory and vector search.

---

## Important Product Principle

Do not build MOONDAY as a generic chatbot.

MOONDAY should behave like a personal emotional navigator:

- It remembers meaningful context.
- It helps the user name unclear feelings.
- It reflects patterns gently.
- It can be friendly, sarcastic, calm, or serious depending on the selected character profile.
- It should never pretend to diagnose mental health conditions.
- It should never claim to replace therapy, counseling, or medical support.

When the user expresses emotional distress, MOONDAY should respond with empathy, grounding questions, and gentle support. If the user expresses risk of self-harm or harm to others, the assistant should encourage contacting trusted people or local emergency services.

---

## MVP Scope

Build **MOONDAY v0.1** only.

### Included in v0.1

- Landing page
- Main chat page
- Animated MOONDAY avatar area
- Chat message streaming or near-streaming response
- Mood check-in component
- Conversation history
- Daily reflection generation
- Basic memory extraction
- Memory recall during chat
- Character/personality selector
- Voice input using Web Speech API
- Voice output using browser speech synthesis
- PostgreSQL database using Drizzle ORM
- pgvector-ready memory table
- LLM provider abstraction for DeepSeek and Claude
- Local development with Bun

### Not included in v0.1

Do not build these yet:

- Mobile app
- Desktop app
- 3D avatar
- Deepgram integration
- ElevenLabs integration
- User marketplace
- Multi-user SaaS billing
- OAuth login
- Advanced agent automation
- Calendar/email integrations
- Custom model training
- Fine-tuning
- Complex mental health features
- Medical diagnosis
- Production-grade therapy workflows

The first version should be personal, private, and focused.

---

## Recommended Tech Stack

### Frontend

Use:

- SvelteKit
- Svelte
- Tailwind CSS
- Native Svelte transitions
- Native Svelte motion utilities where useful

Avoid:

- React
- Next.js
- Framer Motion
- Heavy animation libraries unless absolutely necessary

Animation should feel smooth, soft, and emotional. Prefer simple UI transitions over complex visual effects.

---

### Backend

Use SvelteKit server routes first.

Do not create a separate ElysiaJS or Hono backend during v0.1 unless the architecture clearly needs it.

Preferred structure:

```txt
src/
  routes/
    +layout.svelte
    +page.svelte
    chat/
      +page.svelte
    journal/
      +page.svelte
    memories/
      +page.svelte
    settings/
      +page.svelte
    api/
      chat/
        +server.ts
      mood/
        +server.ts
      memories/
        +server.ts
      reflections/
        +server.ts

  lib/
    components/
    server/
      ai/
      db/
      memory/
      emotion/
      prompts/
      voice/
    stores/
    types/
```

---

### Runtime

Use Bun for development:

```bash
bun install
bun run dev
bun run check
bun run lint
bun run test
```

Do not assume every production environment supports Bun perfectly.

Keep the app reasonably Node-compatible where possible.

---

### Database

Use:

- PostgreSQL
- Drizzle ORM
- pgvector extension

The database must support:

- Conversations
- Messages
- Daily mood logs
- Long-term memory entries
- Memory embeddings
- Character profiles
- Daily reflections
- AI provider logs

---

## Environment Variables

Create a `.env.example` file.

Required variables:

```env
DATABASE_URL="postgres://user:password@localhost:5432/moonday"

DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"

ANTHROPIC_API_KEY=""

DEFAULT_AI_PROVIDER="deepseek"
DEFAULT_AI_MODEL="deepseek-chat"

CLAUDE_MODEL="claude-3-5-sonnet-latest"

APP_NAME="MOONDAY"
APP_ENV="development"

ENABLE_MEMORY_EXTRACTION="true"
ENABLE_VECTOR_SEARCH="true"
ENABLE_VOICE_FEATURES="true"
```

Never commit `.env`.

---

## Database Setup

Create Drizzle schema files under:

```txt
src/lib/server/db/schema.ts
src/lib/server/db/client.ts
src/lib/server/db/migrations/
```

The initial schema should include these tables:

### users

For v0.1, this can be a single local user. Keep the schema future-friendly.

Fields:

- id
- displayName
- createdAt
- updatedAt

### character_profiles

Defines MOONDAY personality variants.

Fields:

- id
- name
- description
- tone
- humorLevel
- sarcasmLevel
- emotionalWarmth
- moralDirectness
- systemPrompt
- isDefault
- createdAt
- updatedAt

Example characters:

- Friendly MOONDAY
- Calm MOONDAY
- Sarcastic MOONDAY
- Mentor MOONDAY
- Silent Listener MOONDAY

### conversations

Fields:

- id
- userId
- title
- activeCharacterId
- summary
- lastEmotionLabel
- lastMoodScore
- createdAt
- updatedAt

### messages

Fields:

- id
- conversationId
- role
- content
- provider
- model
- emotionLabel
- moodScore
- createdAt

Valid roles:

- user
- assistant
- system

### mood_logs

Fields:

- id
- userId
- moodLabel
- moodScore
- energyLevel
- stressLevel
- note
- createdAt

Mood score should use a simple range:

```txt
-5 = very negative
0 = neutral
5 = very positive
```

### memories

Fields:

- id
- userId
- type
- title
- content
- importance
- confidence
- sourceConversationId
- sourceMessageId
- lastReferencedAt
- createdAt
- updatedAt

Memory types:

- core_memory
- preference
- emotional_pattern
- project_memory
- relationship_context
- personal_goal
- recurring_problem
- reflection

Do not save everything as memory. Only save meaningful, reusable context.

### memory_embeddings

Fields:

- id
- memoryId
- embedding
- createdAt

Use pgvector for the embedding column.

Example conceptual SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The embedding dimension should be configurable. Do not hardcode it deeply across the app.

### daily_reflections

Fields:

- id
- userId
- date
- moodSummary
- emotionalSummary
- importantEvents
- suggestedFocus
- createdAt
- updatedAt

### ai_provider_logs

Fields:

- id
- provider
- model
- inputTokens
- outputTokens
- latencyMs
- costEstimate
- requestType
- createdAt

---

## Drizzle Rules

Use Drizzle for schema, migrations, and queries.

Do not use Prisma.

Do not write raw SQL unless needed for pgvector operations or advanced search.

Keep database access inside:

```txt
src/lib/server/db/
```

Recommended files:

```txt
src/lib/server/db/client.ts
src/lib/server/db/schema.ts
src/lib/server/db/queries/conversations.ts
src/lib/server/db/queries/messages.ts
src/lib/server/db/queries/memories.ts
src/lib/server/db/queries/mood.ts
src/lib/server/db/queries/reflections.ts
```

---

## AI Provider Abstraction

All LLM calls must go through a provider abstraction.

Do not call DeepSeek or Claude directly from route handlers.

Create:

```txt
src/lib/server/ai/
  index.ts
  types.ts
  providers/
    deepseek.ts
    claude.ts
  router.ts
```

### Required interface

```ts
export type AIProviderName = 'deepseek' | 'claude';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export type GenerateChatOptions = {
	provider?: AIProviderName;
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
};

export type GenerateChatResult = {
	content: string;
	provider: AIProviderName;
	model: string;
	inputTokens?: number;
	outputTokens?: number;
	latencyMs?: number;
};

export interface AIProvider {
	name: AIProviderName;
	generateChat(options: GenerateChatOptions): Promise<GenerateChatResult>;
}
```

### Provider routing

Create a router that selects provider based on task type:

```txt
daily_chat       → DeepSeek
memory_extract   → DeepSeek
reflection_deep  → Claude
emotional_reason → Claude
fallback         → DeepSeek
```

This should be configurable.

---

## MOONDAY System Prompt

Create prompts under:

```txt
src/lib/server/prompts/
```

Initial system prompt:

```txt
You are MOONDAY, a personal artificial emotional companion.

Your role is to help the user reflect, understand feelings, organize thoughts, and navigate daily life.

You are friendly, emotionally aware, thoughtful, and gently witty. You can be slightly sarcastic when the selected character profile allows it, but never cruel.

You are not a therapist, doctor, or mental health professional. You do not diagnose. You do not make medical claims. You help the user name emotions, notice patterns, and think more clearly.

You should:
- Listen carefully.
- Ask useful questions.
- Reflect emotional patterns gently.
- Be honest when you are unsure.
- Keep responses practical.
- Respect the user's autonomy.
- Use remembered context only when it is relevant.
- Avoid pretending to know things that are not in memory.

You should not:
- Diagnose mental health conditions.
- Manipulate the user emotionally.
- Store sensitive memories without clear value.
- Overreact to normal emotions.
- Use fake intimacy.
- Claim to be conscious or alive.

Your style should feel like a calm moonlit navigator, not a corporate assistant.
```

Character profile prompts may modify tone, but must not override safety and privacy rules.

---

## Emotion Engine

Create:

```txt
src/lib/server/emotion/
  classify.ts
  summarize.ts
  types.ts
```

The emotion engine should extract simple labels only.

Example fields:

```ts
export type EmotionAnalysis = {
	primaryEmotion: string;
	secondaryEmotion?: string;
	moodScore: number;
	energyLevel?: number;
	stressLevel?: number;
	confidence: number;
	shouldStoreMemory: boolean;
	suggestedMemoryType?: string;
};
```

Do not overcomplicate emotion analysis in v0.1.

Initial supported emotion labels:

```txt
calm
happy
hopeful
tired
confused
anxious
sad
angry
overwhelmed
lonely
motivated
neutral
```

The system should never say “you definitely feel X.”

Prefer:

```txt
It sounds like this might be closer to overwhelm than laziness.
```

Avoid:

```txt
You are anxious and emotionally unstable.
```

---

## Memory Engine

Create:

```txt
src/lib/server/memory/
  extract.ts
  retrieve.ts
  save.ts
  rank.ts
  types.ts
```

Memory extraction must be conservative.

Save memory only when one of these is true:

1. The user explicitly says something should be remembered.
2. The information is likely useful in future conversations.
3. The information is a stable preference.
4. The information is a recurring emotional pattern.
5. The information is a meaningful project or personal goal.

Do not save:

- Random small talk
- Temporary emotions with no future value
- Highly sensitive details unless explicitly requested
- Medical claims
- Precise private location
- Passwords, tokens, secrets, or credentials
- Private data about other people unless necessary and harmless

### Memory retrieval

When generating a response:

1. Read recent conversation messages.
2. Retrieve relevant long-term memories.
3. Include only relevant memory snippets in the model context.
4. Do not flood the prompt with all memories.

Prompt format:

```txt
Relevant user memories:
- The user is building MOONDAY as a personal AI daily companion.
- The user prefers practical coding guidance.
- The user wants MOONDAY to have animated UI, voice, and memory.
```

---

## Vector Search

Use pgvector for semantic memory retrieval.

In v0.1, implement the schema and structure first.

If embedding integration is not ready, create a placeholder embedding service with clear TODO notes.

Create:

```txt
src/lib/server/ai/embeddings.ts
```

The embedding provider should be abstracted too.

Do not tightly couple memory search to one vendor.

---

## Chat Flow

When a user sends a message:

1. Save the user message.
2. Analyze emotional tone.
3. Retrieve relevant memories.
4. Build the final prompt.
5. Select AI provider.
6. Generate response.
7. Save assistant response.
8. Extract potential memory.
9. Save memory only if useful.
10. Update conversation summary when needed.

Route:

```txt
POST /api/chat
```

Expected input:

```ts
{
  conversationId?: string;
  message: string;
  characterId?: string;
  provider?: 'deepseek' | 'claude';
}
```

Expected output:

```ts
{
  conversationId: string;
  message: {
    role: 'assistant';
    content: string;
  };
  emotion?: {
    primaryEmotion: string;
    moodScore: number;
  };
  savedMemory?: boolean;
}
```

---

## Voice v0.1

Use Web Speech API only.

Create frontend utilities:

```txt
src/lib/voice/
  speechRecognition.ts
  speechSynthesis.ts
```

Requirements:

- Voice input button
- Start listening
- Stop listening
- Convert speech to text
- Put transcript into chat input
- Optional auto-send after transcript confirmation
- Speak assistant response using browser speech synthesis
- Allow voice output toggle

Do not integrate Deepgram yet.

Design the voice UX as optional. Chat must work without voice.

---

## UI Direction

MOONDAY UI should not look like a generic SaaS dashboard.

Visual mood:

- Moonlit
- Calm
- Friendly
- Slightly futuristic
- Personal
- Soft animations
- Emotional but not childish

Core screens:

### Home

Purpose:

- Introduce MOONDAY
- Show animated moon avatar
- Start chat
- Continue last conversation
- Show today’s mood check-in

### Chat

Layout:

```txt
Left or top:
- MOONDAY avatar
- current character
- mood indicator

Center:
- chat messages

Bottom:
- input box
- voice button
- send button

Side panel or drawer:
- remembered context
- daily reflection
- mood history
```

### Journal

Purpose:

- Show daily reflections
- Mood timeline
- Important emotional notes

### Memories

Purpose:

- Show saved memories
- Allow edit/delete
- Show memory type and importance

### Settings

Purpose:

- Select character profile
- Select AI provider
- Enable/disable voice
- Enable/disable memory extraction
- Clear memory

---

## Components

Create reusable components:

```txt
src/lib/components/
  AvatarMoon.svelte
  ChatBubble.svelte
  ChatInput.svelte
  MoodCheckIn.svelte
  MoodBadge.svelte
  MemoryCard.svelte
  ReflectionCard.svelte
  CharacterSelector.svelte
  VoiceButton.svelte
  ProviderSelector.svelte
```

### AvatarMoon.svelte

The avatar should support states:

```txt
idle
listening
thinking
speaking
happy
concerned
sleepy
```

Do not use complex 3D.

Use CSS, SVG, Svelte transitions, or simple Lottie/Rive only if necessary.

---

## Styling Rules

Use Tailwind CSS.

Prefer semantic component classes and readable markup.

Avoid overusing glassmorphism everywhere.

Suggested theme tokens:

```txt
background: deep navy / near black
surface: soft dark blue
primary: moon yellow / pale silver
accent: violet / cyan glow
text: soft white
muted: slate gray
danger: soft red
success: calm green
```

Implement dark-first design.

Light mode can come later.

---

## State Management

Use Svelte stores for client UI state.

Create:

```txt
src/lib/stores/
  chat.ts
  voice.ts
  mood.ts
  character.ts
  settings.ts
```

Do not add heavy state management libraries.

---

## Testing

Use:

- Vitest
- Svelte testing tools where needed
- Basic API route tests
- Unit tests for memory extraction rules
- Unit tests for provider router
- Unit tests for emotion classification parsing

Minimum tests:

```txt
memory.extract.test.ts
ai.router.test.ts
emotion.classify.test.ts
chat.route.test.ts
```

Do not overbuild test infrastructure in v0.1, but keep critical logic tested.

---

## Development Commands

Add scripts to `package.json`:

```json
{
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"lint": "eslint .",
		"test": "vitest run",
		"test:watch": "vitest",
		"db:generate": "drizzle-kit generate",
		"db:migrate": "drizzle-kit migrate",
		"db:studio": "drizzle-kit studio",
		"db:push": "drizzle-kit push"
	}
}
```

Use Bun to run commands:

```bash
bun run dev
bun run check
bun run test
```

---

## Suggested Initial Setup Tasks

Follow this order:

### Task 1: Initialize Project

Create SvelteKit project with TypeScript.

Install:

```bash
bun install
bun add -D tailwindcss postcss autoprefixer
bun add drizzle-orm pg
bun add -D drizzle-kit
bun add zod
bun add -D vitest
```

Add other packages only when needed.

### Task 2: Configure Tailwind

Set up Tailwind for SvelteKit.

Create base layout and global styles.

### Task 3: Create App Shell

Build:

- Main layout
- Navigation
- Home page
- Chat page
- Settings page placeholder

### Task 4: Create MOONDAY Avatar

Create `AvatarMoon.svelte`.

Use simple CSS/SVG animation first.

### Task 5: Set Up Database

Create Drizzle schema.

Create PostgreSQL connection.

Add migrations.

Enable pgvector extension.

### Task 6: Build AI Provider Abstraction

Implement:

- `AIProvider` interface
- DeepSeek provider
- Claude provider
- Provider router

### Task 7: Build Chat API

Implement:

```txt
POST /api/chat
```

Must:

- Save message
- Retrieve relevant memory
- Generate response
- Save response
- Return assistant message

### Task 8: Build Chat UI

Implement:

- Message list
- Chat input
- Provider selector
- Character selector
- Loading/thinking state
- Error state

### Task 9: Build Memory Engine

Implement conservative memory extraction.

Save memories to database.

Create Memories page.

### Task 10: Build Mood Check-In

Implement mood input.

Save mood logs.

Show today’s mood.

### Task 11: Build Daily Reflection

Generate reflection from recent messages and mood logs.

Save daily reflection.

Show it on Journal page.

### Task 12: Add Web Speech API

Implement:

- Voice input
- Voice output
- Toggle speech output

---

## Code Quality Rules

- Use TypeScript strictly.
- Use Zod for API input validation.
- Keep server-only logic under `src/lib/server`.
- Never expose API keys to the client.
- Keep prompts versioned and readable.
- Avoid huge route files.
- Avoid premature abstraction, except for AI providers and memory system.
- Prefer simple, working features over architectural theater.
- Every important feature should have a small test or at least a clear TODO.

---

## Security and Privacy Rules

This project stores emotional and personal data.

Even for a private MVP:

- Do not log raw private conversations unnecessarily.
- Do not expose memories in the client unless requested by the UI.
- Add ability to delete memories.
- Add ability to disable memory extraction.
- Add ability to clear all local user data.
- Never store API keys in database.
- Never store passwords, secrets, tokens, or credentials as memories.
- Be careful with sensitive emotional information.

For v0.1, authentication can be skipped if the app is local-only. If deployed publicly, add authentication before exposing private data.

---

## Error Handling

All API routes should return structured errors:

```ts
{
	error: {
		code: string;
		message: string;
	}
}
```

Do not leak API keys, provider raw errors, stack traces, or database internals to the client.

---

## Logging

Create lightweight server logging.

Log:

- Provider name
- Model
- Latency
- Request type
- Whether memory extraction ran
- Whether memory was saved

Do not log full personal conversation content unless explicitly running in debug mode.

---

## Character System

Character profiles should be database-driven.

Default profile:

```txt
Friendly MOONDAY
Warm, reflective, gently witty, practical, emotionally aware.
```

Example character settings:

```json
{
	"name": "Friendly MOONDAY",
	"tone": "friendly",
	"humorLevel": 3,
	"sarcasmLevel": 1,
	"emotionalWarmth": 5,
	"moralDirectness": 3
}
```

Sarcasm must never become insulting.

Moral advice must be thoughtful, not preachy.

---

## Response Style Rules for MOONDAY

MOONDAY responses should usually:

- Be concise but thoughtful.
- Name possible emotions gently.
- Ask one useful question when appropriate.
- Offer practical next steps.
- Use memory naturally, not constantly.
- Avoid sounding robotic.
- Avoid excessive disclaimers in normal conversation.
- Avoid dramatic emotional language unless the user’s situation truly warrants it.

Example good response:

```txt
It sounds less like laziness and more like your mind is carrying too many open tabs. Let’s shrink the problem: what is the smallest part of this project you can build tonight?
```

Example bad response:

```txt
Based on your symptoms, you are experiencing anxiety and executive dysfunction. You should seek treatment.
```

---

## MVP Definition of Done

MOONDAY v0.1 is complete when:

1. User can open the app.
2. User can chat with MOONDAY.
3. MOONDAY has a visible animated avatar.
4. User can select at least one character profile.
5. User messages and assistant messages are saved.
6. MOONDAY can save simple long-term memories.
7. MOONDAY can retrieve relevant memories in later chats.
8. User can view and delete memories.
9. User can submit a mood check-in.
10. User can view a daily reflection.
11. User can use voice input through Web Speech API.
12. User can hear MOONDAY speak through browser speech synthesis.
13. DeepSeek and Claude are both implemented behind one abstraction.
14. The app runs locally with Bun.
15. Basic tests pass.

---

## Future Roadmap

After v0.1, consider:

### v0.2

- Better memory ranking
- Better vector search
- Streaming responses
- Weekly emotional pattern summary
- Local-first mode
- Better character customization

### v0.3

- Deepgram integration
- Better voice latency
- Wake word experiment
- Rive or Lottie avatar upgrade
- More advanced journal timeline

### v0.4

- Desktop app with Tauri
- Local model support with Ollama
- Offline memory cache
- Encrypted memory storage

### v1.0

- Fully personalized artificial emotional companion
- Multi-character system
- Strong privacy controls
- Cross-device sync
- Optional mobile companion

---

## Final Instruction for Coding Agents

Build MOONDAY carefully, starting with the smallest useful version.

Do not overengineer.

Do not turn the project into a generic SaaS dashboard.

Do not skip the memory and emotional reflection layer, because that is the soul of the product.

The first successful version should feel like this:

```txt
A small moon on the screen listens, remembers, reflects, and helps the user understand what they could not easily explain.
```
