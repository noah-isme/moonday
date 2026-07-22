# MOONDAY Product Backlog

## Product direction

MOONDAY is a private emotional companion: calm, context-aware, practical, and lightly witty. The target experience draws on the interaction qualities of fictional assistants such as F.R.I.D.A.Y. and K.A.R.E.N.—competence, timely context, warmth, and dry humor—without copying their names, voices, dialogue, or identity.

MOONDAY should not pursue Character.AI as a public character marketplace. Its advantage is private continuity: helping one person navigate their day, thoughts, goals, moods, and the online moments they bring into chat.

## Prioritization principles

- Build trust and conversation quality before adding more input types or integrations.
- Keep the user in control of memories, proactive behavior, and voice.
- Treat emotional observations as tentative reflections, never diagnosis.
- Prefer small, useful companion moments over dashboard-heavy features.
- Do not add passive social monitoring, feed scraping, or public sharing.

## Now — stabilize the companion foundation

### P0. Complete server-owned conversation lifecycle

**Status: Complete**

**Outcome:** every chat has one durable source of truth and survives refreshes consistently.

- [x] Add server API support for conversation rename and deletion.
- [x] Persist title changes and deletions; remove client-only conversation mutations.
- [x] Maintain a server-generated welcome conversation and consistent character-specific greeting.
- [x] Add reliable latest-conversation loading and empty-state recovery.
- [x] Create conversation summaries after meaningful exchanges to preserve continuity without sending the entire history to the model.

**Done when:** creating, renaming, deleting, reopening, and continuing a chat produce the same result across reloads and devices using the same database.

### P1. Improve response quality and context selection

**Status: Complete**

**Outcome:** MOONDAY feels attentive rather than scripted or repetitive.

- [x] Rank and limit recalled memories by relevance, importance, recency, and privacy sensitivity.
- [x] Use conversation summaries plus a focused recent-message window.
- [x] Reduce repetitive empathy, forced questions, and unnecessary restatement.
- [x] Respect the selected response language reliably, including automatic English/Indonesian detection.
- [x] Add graceful provider fallback, retry messaging, and a clear unavailable-provider state.

**Done when:** responses naturally reference only useful context, match the user’s language, and recover cleanly from provider failures.

### P2. Make memory transparent and controllable

**Status: Complete**

**Outcome:** remembered context feels helpful, never mysterious.

- [x] Show which memory snippets informed a reply without exposing hidden internal prompt content.
- [x] Add per-conversation memory controls: disable extraction, do not save this, and review pending memories.
- [x] Support edit, delete, and clear-all memory actions with confirmation.
- [x] Add conservative rules for sensitive content and prevent secrets, credentials, precise locations, and unnecessary third-party details from being saved.

**Done when:** the user can see, correct, remove, and prevent memories with minimal effort.

## Next — make MOONDAY feel personally present

### P3. Proactive daily continuity

**Status: Complete**

**Outcome:** MOONDAY can gently reconnect daily events without becoming noisy.

- [x] Offer an optional daily check-in on the home/chat screen.
- [x] Use explicit user goals, recent mood, and unfinished topics for a single relevant follow-up.
- [x] Let the user configure timing, frequency, and disable proactive prompts entirely.
- [x] Add a “continue,” “reflect,” and “start fresh” choice at the beginning of a new day.

**Done when:** a follow-up feels timely and useful, and the user always controls whether it happens.

### P4. Expand personality and interaction preferences

**Status: Complete**

**Outcome:** MOONDAY can feel like the user’s preferred kind of copilot.

- [x] Refine warmth, humor, directness, curiosity, response length, and formality controls.
- [x] Provide safe presets: **Calm Operator**, **Friendly Copilot**, and **Dryly Witty Observer**.
- [x] Add a live sample response before a preference is saved.
- [x] Keep all character profiles within the same safety, privacy, and non-diagnostic boundaries.

**Done when:** changing a preference produces a consistent, recognizable shift in style without becoming cruel, fake-intimate, or unstable.

### P5. Conversation steering and useful artifacts

**Status: Complete**

**Outcome:** the user can shape a reply rather than starting over.

- [x] Offer response variants: shorter, warmer, funnier, more direct, more practical, and go deeper.
- [x] Allow message editing, regenerate, and branching a conversation from an earlier message.
- [x] Support pinning a useful answer by explicitly saving a reflection to memories.
- [x] Add one-click conversation summaries and optional action-item extraction.

**Done when:** users can quickly turn an almost-right response into a useful one.

### P6. Voice interaction polish

**Status: Complete**

**Outcome:** speaking with MOONDAY is an optional, smooth interaction.

- [x] Improve push-to-talk, listening states, transcript review, and cancel/stop controls. Basic voice input and listening states are available.
- [x] Let users interrupt speech output and choose response voice settings.
- [x] Prefer concise speech responses and respect the language of the conversation.
- [x] Maintain full keyboard/chat usability when browser voice APIs are unavailable.

**Done when:** voice feels additive, can be stopped instantly, and never blocks text chat.

## Later — thoughtful co-viewer capabilities

### P7. Social-content companion mode

**Status: Complete**

**Outcome:** the user can bring an online moment to MOONDAY for a private reaction or clearer perspective.

- [x] Add **Bring something you saw** as a chat action.
- [x] Support pasted text and URLs first. Screenshot upload remains deferred until explicit deletion controls are implemented.
- [x] Offer modes: Read the room, Playful commentary, Reality check, Help me respond, and Reflect on my reaction.
- [x] Preserve the selected language and personality while preventing cruel jokes, harassment, and speculation about private people.
- [x] Scope shared content to the current conversation by default; do not save it as memory automatically.

**Done when:** a user can turn a post, Reel, or caption into a laugh, clearer thought, or calmer response in under a minute.

See [Thoughtful Co-Viewer](thoughtful-co-viewer.md) for detailed product boundaries and phased scope.

### P8. Multimodal context

**Status: Complete**

**Outcome:** MOONDAY can understand user-provided visual context without becoming a surveillance tool.

- [x] Add screenshot/image attachments with visible upload, retention, and deletion behavior.
- [x] Add safe URL previews and explicit confirmation before fetching external content.
- [x] Use user-provided visual context only for the current chat unless the user explicitly saves a distilled reflection.
- [x] Defer video transcription, account connections, feed ingestion, and background monitoring.

**Done when:** attachments are useful, clearly scoped, and removable.

## Later — reflection depth and learning loop

### P9. Emotional timeline and weekly reflection

**Outcome:** patterns become understandable without turning into clinical analysis.

- Show mood check-ins, recurring topics, notable wins, and stressors over time.
- Generate a weekly reflection with tentative language and practical next steps.
- Link insights to user-approved memories and journal entries, not hidden inferences.
- Let users correct or dismiss an insight.

**Done when:** the timeline helps the user notice patterns while respecting uncertainty and privacy.

### P10. Quality feedback loop

**Outcome:** MOONDAY becomes more useful through explicit, privacy-aware signals.

- Add lightweight private feedback: helpful, not helpful, too long, too generic, too much humor, and wrong language.
- Use feedback to evaluate prompts, character settings, routing, and memory retrieval offline or in aggregate.
- Never train on private conversations or share them externally without explicit opt-in.

**Done when:** recurring quality issues can be measured and improved without collecting unnecessary personal content.

## Explicitly deferred

- Public character marketplace or follower system.
- Social account connections, feed scraping, or passive monitoring.
- Creator scoring, engagement analytics, or automated posting.
- Medical, diagnostic, or therapy-replacement workflows.
- Autonomous actions in the user’s accounts or real-world services.
- Custom model training on private conversation data.

## Suggested delivery order

| Release                 | Backlog items | Purpose                                            |
| ----------------------- | ------------- | -------------------------------------------------- |
| v0.1 hardening          | P0–P2         | A reliable, private companion foundation.          |
| v0.2 companion presence | P3–P6         | A more natural daily copilot experience.           |
| v0.3 co-viewer          | P7–P8         | User-controlled reactions to online content.       |
| v0.4 reflection quality | P9–P10        | Better long-term insight and measured improvement. |
