# MOONDAY Thoughtful Co-Viewer

## Purpose

MOONDAY should help the user process the internet they already encounter: a Reel, post, screenshot, caption, comment thread, or link. It is a personal emotional companion and cultural co-viewer, not a social-feed product.

The feature should make everyday online moments more legible, lighter, and more useful. It can notice emotional hooks, add gentle humor, help the user form a response, or simply share a laugh.

## Product principle

MOONDAY does not passively watch the user’s feeds, optimize engagement, or infer facts about strangers. The user deliberately brings content into a private conversation, and remains in control of what is stored.

## Core user flow

1. The user chooses **Bring something you saw** in chat.
2. They paste text, a link, or upload/share a screenshot in a future iteration.
3. They choose a response mode, or leave it on **Read the room**.
4. MOONDAY responds in the user’s selected language and personality style.
5. The user can steer the response: shorter, more practical, go deeper, speak, or save a reflection.
6. No submitted content becomes a long-term memory unless it has reusable value and the user explicitly saves it or memory extraction qualifies it under the normal privacy rules.

## Response modes

| Mode                   | What MOONDAY does                                                                   | Example request                            |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| Read the room          | Names the tone, context, and likely emotional hook without overclaiming.            | “Why does this post feel weirdly intense?” |
| Playful commentary     | Makes a light, non-cruel observation about internet behavior or the post’s energy.  | “Give me a gentle roast of this Reel.”     |
| Reality check          | Separates useful ideas from comparison bait, rage bait, or marketing pressure.      | “Is this advice useful or just content?”   |
| Help me respond        | Drafts a reply, comment, caption, or boundary-setting response in the user’s voice. | “Reply without sounding defensive.”        |
| Reflect on my reaction | Centers the user’s reaction rather than judging the creator.                        | “Why did this make me feel behind?”        |

## Tone rules

- Humor should target the post’s framing, internet tropes, or absurdity—not a private individual’s identity, appearance, vulnerability, or protected traits.
- A sarcastic character may be witty, but never humiliating or cruel.
- Use uncertainty honestly: “This reads a bit like…” rather than claiming the creator’s intent as fact.
- When content triggers comparison, anxiety, anger, or shame, help the user identify the hook and choose a useful next step.
- Keep normal reactions normal. MOONDAY is not a therapist and must not diagnose the user or the person who posted the content.

## Privacy and safety boundaries

- No social account connection, feed scraping, background monitoring, or automatic profile analysis in the first release.
- Do not identify, dox, or speculate about private people.
- Do not retain links, screenshots, names, or post content as memory by default.
- Treat screenshots and copied posts as user-provided private context. Show the user when the content is being used and allow them to dismiss it.
- Refuse requests to harass, impersonate, manipulate, or organize abuse toward another person.

## MVP scope

### Include

- A **Bring something you saw** starter action in chat.
- Pasted text and URL input.
- The five response modes above.
- Existing language, personality, regenerate, and response-steering controls.
- A visible note that shared content is used only for the current response unless saved.

### Defer

- Native Instagram, TikTok, X, or YouTube account connections.
- Passive feed ingestion or notifications.
- Automatic screenshot OCR and video transcription.
- Creator scoring, sentiment dashboards, or engagement analytics.
- Multi-user sharing or public posting.

## Suggested prompts

- “Read the room on this: [paste].”
- “Give me a gentle roast, not a mean one.”
- “What emotional button is this Reel pushing?”
- “Help me reply with warmth but keep my boundary.”
- “I saw this and suddenly felt behind. Help me unpack that.”

## Implementation phases

### Phase 1 — conversational MVP

Add the starter action, response-mode chips, and prompt instructions. Persist only the normal chat message; do not create a new data model yet.

### Phase 2 — richer user-provided context

Add URL previews and optional screenshot upload with explicit deletion controls. Keep content scoped to the current conversation by default.

### Phase 3 — deliberate integrations

Only after the private flow is valuable, consider opt-in share-sheet or browser-extension capture. Never add passive monitoring as a default.

## Success criteria

- The user can turn an online moment into a laugh, a clearer thought, or a calmer next action in under a minute.
- The experience feels personal and culturally aware without becoming a feed, gossip engine, or generic chatbot.
- The user understands what content is used, what is remembered, and how to remove it.
