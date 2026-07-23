<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { memoryStore } from '$lib/stores/memory.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';
	import ChatBubble from '$lib/components/ChatBubble.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import ProviderSelector from '$lib/components/ProviderSelector.svelte';
	import CoViewerComposer from '$lib/components/CoViewerComposer.svelte';
	import type { CoViewerMode } from '$lib/types/co-viewer';
	import type { ImageAttachment, UrlContext } from '$lib/types/multimodal';
	import MultimodalContextComposer from '$lib/components/MultimodalContextComposer.svelte';
	import ConversationHistory from '$lib/components/ConversationHistory.svelte';
	import AvatarMoon from '$lib/components/AvatarMoon.svelte';
	import {
		BookOpenText,
		History,
		PanelLeftClose,
		Settings2,
		Volume2,
		VolumeX,
		X
	} from 'lucide-svelte';

	let scrollContainer = $state<HTMLDivElement | null>(null);
	let drawerOpen = $state(false);
	let historyPanelOpen = $state(true);
	let dailyPromptDismissed = $state(false);
	let dailyContinuity = $state<{
		source: 'mood' | 'goal' | 'conversation' | 'check_in';
		prompt: string;
	} | null>(null);
	let doNotRememberNextMessage = $state(false);
	let coViewerOpen = $state(false);
	let multimodalOpen = $state(false);

	let activeConv = $derived(chatStore.activeConversation);
	let messages = $derived(chatStore.activeMessages);
	let lastAssistantId = $derived(
		[...messages].reverse().find((message) => message.role === 'assistant')?.id
	);
	let isThinkingOrStreaming = $derived(chatStore.isThinking || chatStore.isStreaming);
	let showStarterPrompts = $derived(
		!chatStore.isThinking &&
			!chatStore.isStreaming &&
			!messages.some((message) => message.role === 'user')
	);
	let showDailyContinuity = $derived(
		!dailyPromptDismissed &&
			settingsStore.proactiveCheckInsEnabled &&
			dailyContinuity !== null &&
			(settingsStore.proactiveCheckInFrequency !== 'weekdays' ||
				![0, 6].includes(new Date().getDay())) &&
			isPreferredContinuityTime()
	);

	const starterPrompts = [
		'Unload what is on my mind.',
		'Help me plan one small next step.',
		'Help me reflect on today.',
		'I just want you to listen.'
	];

	function isPreferredContinuityTime() {
		const hour = new Date().getHours();
		if (settingsStore.proactiveCheckInTime === 'morning') return hour < 12;
		if (settingsStore.proactiveCheckInTime === 'afternoon') return hour >= 12 && hour < 17;
		return hour >= 17;
	}

	// Auto-scroll to bottom of chat
	async function scrollToBottom(behavior: 'auto' | 'smooth' = 'smooth') {
		await tick();
		if (scrollContainer) {
			scrollContainer.scrollTo({
				top: scrollContainer.scrollHeight,
				behavior
			});
		}
	}

	// Trigger scrolling when messages change or content of last message updates, or AI is thinking/streaming
	$effect(() => {
		const lastContent = messages[messages.length - 1]?.content;
		if (messages.length > 0 || chatStore.isThinking || chatStore.isStreaming || lastContent) {
			scrollToBottom('smooth');
		}
	});

	// Speak only a completed assistant response. Streaming first adds an empty shell, so counting
	// messages would otherwise attempt synthesis before any text has arrived.
	let voiceConversationId = $state<string | null>(null);
	let lastSpokenAssistantId = $state<string | null>(null);
	$effect(() => {
		const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

		// Establish a baseline after server hydration or conversation switching. Old history must not
		// suddenly be read aloud when the user opens a chat.
		if (voiceConversationId !== activeConv?.id) {
			voiceConversationId = activeConv?.id || null;
			lastSpokenAssistantId = latestAssistant?.id || null;
			return;
		}

		if (
			latestAssistant?.persisted &&
			latestAssistant.content.trim() &&
			latestAssistant.id !== lastSpokenAssistantId &&
			!chatStore.isThinking &&
			!chatStore.isStreaming &&
			settingsStore.voiceOutputEnabled
		) {
			lastSpokenAssistantId = latestAssistant.id;
			voiceStore.speak(latestAssistant.content);
		}
	});

	onMount(() => {
		scrollToBottom('auto');
		if (settingsStore.proactiveCheckInsEnabled && isPreferredContinuityTime()) {
			void fetch('/api/daily-continuity')
				.then((response) => (response.ok ? response.json() : null))
				.then((data) => {
					dailyContinuity = data?.continuity || null;
				})
				.catch(() => {
					dailyContinuity = null;
				});
		}
	});

	onDestroy(() => {
		// Stop any speech synthesis when leaving chat
		voiceStore.stopSpeaking();
	});

	async function handleSend(text: string) {
		voiceStore.stopSpeaking(); // Stop speaking user's current speech if they type/send new message
		const doNotRemember = doNotRememberNextMessage;
		doNotRememberNextMessage = false;
		await chatStore.sendMessage(text, { doNotRemember });
	}

	async function handleCoViewerSubmit(content: string, mode: CoViewerMode) {
		coViewerOpen = false;
		const modeLabel = mode.replaceAll('_', ' ');
		await chatStore.sendMessage(
			`I brought something I saw online. Please ${modeLabel} on it:\n\n${content}`,
			{
				doNotRemember: true,
				coViewerMode: mode
			}
		);
	}

	async function handleMultimodalContext(context: {
		images: ImageAttachment[];
		urlContext?: UrlContext;
	}) {
		multimodalOpen = false;
		const description = context.images.length
			? `I shared ${context.images.length === 1 ? 'an image' : `${context.images.length} images`} for context.`
			: 'I shared a link preview for context.';
		await chatStore.sendMessage(description, {
			doNotRemember: true,
			images: context.images,
			urlContext: context.urlContext
		});
	}

	async function savePendingMemory(index: number) {
		const memory = chatStore.pendingMemories[index];
		if (!memory) return;
		const saved = await memoryStore.saveSuggestion(memory);
		if (saved) chatStore.dismissPendingMemory(index);
	}

	function switchProvider() {
		settingsStore.setProvider(settingsStore.provider === 'deepseek' ? 'groq' : 'deepseek');
	}

	async function retryWithoutWebSearch() {
		if (chatStore.isWebSearchEnabled) chatStore.toggleWebSearch();
		await chatStore.retryLastMessage();
	}

	function handleSelectChat(id: string) {
		chatStore.selectConversation(id);
		setHistoryDrawer(false);
		scrollToBottom('auto');
	}

	function setHistoryDrawer(open: boolean) {
		const toggle = document.getElementById('conversation-history-toggle') as HTMLInputElement | null;
		if (toggle) toggle.checked = open;
	}

	// Dynamic title based on active companion
	let activeCompanionName = $derived(characterStore.activeCharacter.name);
</script>

<div
	class="relative flex h-[calc(100vh-140px)] min-h-0 flex-1 flex-col gap-4 overflow-hidden md:h-[calc(100vh-40px)] md:flex-row"
>
	<input
		id="conversation-history-toggle"
		type="checkbox"
		class="peer sr-only xl:hidden"
	/>

	{#if historyPanelOpen}
		<aside
			class="hidden w-[280px] min-h-0 flex-shrink-0 overflow-hidden rounded-3xl border border-white/6 xl:block"
			aria-label="Conversation history"
		>
			<ConversationHistory onSelect={handleSelectChat} />
		</aside>
	{/if}

	<!-- Center Chat Message Window -->
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-soft-dark-blue/18 p-3 md:p-5"
	>
		<!-- Chat header -->
		<header class="mb-3 flex items-center justify-between gap-3 px-1 pb-3 select-none">
			<div class="flex min-w-0 items-center gap-3">
				<div class="h-10 w-10 shrink-0">
					<AvatarMoon state={uiStore.moonState} />
				</div>
				<div class="min-w-0">
					<h2 class="truncate text-base font-semibold text-soft-white md:text-lg">
						{activeConv?.title || `Chatting with ${activeCompanionName}`}
					</h2>
					<div class="mt-0.5 flex items-center gap-2 text-xs text-slate-gray">
						<span class="truncate">{activeCompanionName}</span>
						<span aria-hidden="true">·</span>
						<span class="capitalize">{uiStore.moonState}</span>
						<label class="sr-only" for="response-language">Response language</label>
						<select
							id="response-language"
							value={settingsStore.responseLanguage}
							onchange={(event) =>
								settingsStore.setResponseLanguage(
									(event.currentTarget as HTMLSelectElement).value as 'auto' | 'en' | 'id'
								)}
							class="max-w-24 rounded-lg border border-white/8 bg-deep-navy/55 px-2 py-1 text-xs text-pale-silver outline-none"
							title="Response language"
						>
							<option value="auto">Auto language</option>
							<option value="en">English</option>
							<option value="id">Bahasa Indonesia</option>
						</select>
					</div>
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-1">
				<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
				<label
					for="conversation-history-toggle"
					role="button"
					tabindex="0"
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							setHistoryDrawer(true);
						}
					}}
					class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-gray hover:bg-white/6 xl:hidden"
					title="Open conversation history"
					aria-label="Open conversation history"
				>
					<History size={18} aria-hidden="true" />
				</label>
				<button
					type="button"
					onclick={() => (historyPanelOpen = !historyPanelOpen)}
					class="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-gray hover:bg-white/6 xl:inline-flex"
					title={historyPanelOpen ? 'Collapse conversation history' : 'Open conversation history'}
					aria-label={historyPanelOpen
						? 'Collapse conversation history'
						: 'Open conversation history'}
					aria-expanded={historyPanelOpen}
				>
					{#if historyPanelOpen}
						<PanelLeftClose size={18} aria-hidden="true" />
					{:else}
						<History size={18} aria-hidden="true" />
					{/if}
				</button>
				<button
					type="button"
					onclick={() => chatStore.createConversationArtifacts()}
					disabled={!activeConv || chatStore.isThinking || chatStore.isStreaming}
					class="hidden h-9 items-center gap-1.5 rounded-xl border border-white/8 px-3 text-xs font-semibold text-pale-silver hover:bg-white/5 disabled:opacity-50 sm:flex"
					title="Create conversation summary and action items"
				>
					<BookOpenText size={16} aria-hidden="true" />
					<span>Summary</span>
				</button>
				<button
					type="button"
					onclick={() => settingsStore.toggleVoiceOutput()}
					class="icon-button {settingsStore.voiceOutputEnabled
						? 'text-cyan-glow'
						: 'text-slate-gray'}"
					title={settingsStore.voiceOutputEnabled ? 'Mute MOONDAY voice' : 'Enable MOONDAY voice'}
					aria-label={settingsStore.voiceOutputEnabled
						? 'Mute MOONDAY voice'
						: 'Enable MOONDAY voice'}
					aria-pressed={settingsStore.voiceOutputEnabled}
				>
					{#if settingsStore.voiceOutputEnabled}
						<Volume2 size={18} aria-hidden="true" />
					{:else}
						<VolumeX size={18} aria-hidden="true" />
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (drawerOpen = !drawerOpen)}
					class="icon-button text-slate-gray"
					title="Open companion context"
					aria-label="Open companion context"
					aria-expanded={drawerOpen}
				>
					<Settings2 size={18} aria-hidden="true" />
				</button>
			</div>
		</header>

		{#if chatStore.error}
			<div
				role="alert"
				class="mb-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-soft-red/10 border border-soft-red/20 text-xs text-soft-red"
			>
				<div class="min-w-0">
					<span>{chatStore.error}</span>
					<div class="mt-2 flex flex-wrap gap-2">
						<button
							type="button"
							onclick={() => chatStore.retryLastMessage()}
							class="font-semibold hover:text-soft-white">Retry</button
						>
						<button
							type="button"
							onclick={switchProvider}
							class="font-semibold hover:text-soft-white">Switch provider</button
						>
						{#if chatStore.isWebSearchEnabled}
							<button
								type="button"
								onclick={retryWithoutWebSearch}
								class="font-semibold hover:text-soft-white">Continue without web search</button
							>
						{/if}
					</div>
				</div>
				<button
					type="button"
					onclick={() => (chatStore.error = null)}
					aria-label="Dismiss chat error"
					class="icon-button shrink-0 text-soft-red hover:text-soft-white"
				>
					<X size={16} aria-hidden="true" />
				</button>
			</div>
		{/if}

		{#if chatStore.artifacts}
			<div
				class="mb-3 rounded-xl border border-cyan-glow/20 bg-cyan-glow/5 p-3 text-xs text-slate-gray"
			>
				<p class="font-semibold text-pale-silver">Conversation recap</p>
				<p class="mt-1 leading-relaxed">{chatStore.artifacts.summary}</p>
				{#if chatStore.artifacts.actionItems.length > 0}
					<p class="mt-3 font-semibold text-pale-silver">Possible next steps</p>
					<ul class="mt-1 list-disc space-y-1 pl-4">
						{#each chatStore.artifacts.actionItems as item (item)}<li>{item}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}

		{#if chatStore.usedMemories.length > 0}
			<div
				class="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-cyan-glow/15 bg-cyan-glow/5 px-3 py-2 text-xs text-slate-gray"
			>
				<span class="font-semibold text-pale-silver">Using context:</span>
				{#each chatStore.usedMemories as memory (memory.id)}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-cyan-glow/20 px-2 py-0.5 text-cyan-glow"
						title={memory.type}
					>
						{memory.title}
						<button
							type="button"
							onclick={() => chatStore.dismissUsedMemory(memory.id)}
							aria-label={`Dismiss ${memory.title}`}
							class="hover:text-soft-white"
						>
							<X size={12} aria-hidden="true" />
						</button>
					</span>
				{/each}
				<button
					type="button"
					onclick={() => (window.location.href = '/memories')}
					class="ml-auto font-semibold text-pale-silver hover:text-violet-glow"
					>Edit memories</button
				>
			</div>
		{/if}

		{#if chatStore.pendingMemories.length > 0}
			<div
				class="mb-3 rounded-xl border border-violet-glow/25 bg-violet-glow/5 p-3 text-xs text-slate-gray"
			>
				<p class="font-semibold text-pale-silver">
					MOONDAY found context that may be useful later.
				</p>
				<p class="mt-1">Nothing is remembered unless you choose to save it.</p>
				<div class="mt-3 space-y-2">
					{#each chatStore.pendingMemories as memory, index (`${memory.title}-${index}`)}
						<div
							class="flex items-start justify-between gap-3 rounded-lg border border-slate-gray/10 bg-deep-navy/30 px-3 py-2"
						>
							<div class="min-w-0">
								<p class="font-semibold text-pale-silver">{memory.title}</p>
								<p class="mt-0.5 line-clamp-2">{memory.content}</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<button
									type="button"
									onclick={() => savePendingMemory(index)}
									class="font-semibold text-violet-glow hover:text-soft-white">Save</button
								>
								<button
									type="button"
									onclick={() => chatStore.dismissPendingMemory(index)}
									class="hover:text-pale-silver">Not now</button
								>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Scrollable Messages Container -->
		<div
			bind:this={scrollContainer}
			class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 scroll-smooth"
		>
			{#if showDailyContinuity}
				<div
					class="mx-auto mb-4 max-w-lg rounded-2xl border border-violet-glow/20 bg-violet-glow/5 p-4 text-center"
				>
					<p class="text-xs font-semibold text-pale-silver">A new day, a gentle choice</p>
					<p class="mt-1 text-xs text-slate-gray">
						{dailyContinuity?.prompt}
					</p>
					<div class="mt-3 flex flex-wrap justify-center gap-2 text-xs">
						<button
							type="button"
							onclick={() =>
								handleSend(dailyContinuity?.prompt || 'Let’s continue where we left off.')}
							class="rounded-lg border border-slate-gray/15 px-2.5 py-1.5 text-pale-silver hover:border-violet-glow/50"
							>Continue</button
						>
						<button
							type="button"
							onclick={() => handleSend('Help me reflect on yesterday before I begin today.')}
							class="rounded-lg border border-slate-gray/15 px-2.5 py-1.5 text-pale-silver hover:border-violet-glow/50"
							>Reflect</button
						>
						<button
							type="button"
							onclick={() => (dailyPromptDismissed = true)}
							class="rounded-lg px-2.5 py-1.5 text-slate-gray hover:text-pale-silver"
							>Start fresh</button
						>
					</div>
				</div>
			{/if}
			{#each messages as msg (msg.id)}
				{#if msg.role !== 'system'}
					<ChatBubble
						message={msg}
						characterName={activeCompanionName}
						isLastAssistant={msg.id === lastAssistantId}
					/>
				{/if}
			{:else}
				<div
					class="h-full flex flex-col items-center justify-center text-center p-6 select-none opacity-40"
				>
					<div class="mb-3 h-12 w-12"><AvatarMoon /></div>
					<p class="text-sm font-semibold">Start sharing your day.</p>
					<p class="text-xs max-w-xs mt-1">
						MOONDAY parses feelings and reflects contexts dynamically.
					</p>
				</div>
			{/each}

			{#if showStarterPrompts}
				<div class="max-w-lg mx-auto w-full px-2 pb-6 pt-3 text-center">
					<p class="text-xs font-semibold text-pale-silver">A gentle place to begin</p>
					<p class="text-xs text-slate-gray mt-1">Pick a thought, or write your own.</p>
					<div class="grid gap-2 mt-4 text-left">
						{#each starterPrompts as prompt (prompt)}
							<button
								type="button"
								onclick={() => handleSend(prompt)}
								class="w-full px-4 py-3 rounded-2xl bg-deep-navy/40 border border-slate-gray/10 text-xs text-pale-silver hover:border-violet-glow/40 hover:bg-violet-glow/10 transition-colors cursor-pointer"
							>
								{prompt}
							</button>
						{/each}
						<button
							type="button"
							onclick={() => (coViewerOpen = true)}
							class="w-full px-4 py-3 rounded-2xl bg-violet-glow/10 border border-violet-glow/30 text-xs text-pale-silver hover:bg-violet-glow/20 transition-colors cursor-pointer"
							>Bring something you saw</button
						>
					</div>
				</div>
			{/if}

			<!-- Thinking Bubbles -->
			{#if chatStore.isThinking}
				<div class="flex w-full my-4 justify-start animate-pulse">
					<div class="max-w-[70%] flex flex-col gap-1">
						<div class="px-1 text-xs text-slate-gray select-none">
							<span class="font-medium text-pale-silver">{activeCompanionName}</span>
							<span>is thinking...</span>
						</div>
						<div
							class="px-4 py-3 rounded-2xl rounded-tl-none bg-soft-dark-blue text-slate-gray border border-slate-gray/10 text-sm flex items-center gap-1"
						>
							<span class="w-2 h-2 rounded-full bg-slate-gray/40 animate-bounce"></span>
							<span
								class="w-2 h-2 rounded-full bg-slate-gray/40 animate-bounce"
								style="animation-delay: 0.15s"
							></span>
							<span
								class="w-2 h-2 rounded-full bg-slate-gray/40 animate-bounce"
								style="animation-delay: 0.3s"
							></span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Chat Input Area -->
		<div class="mt-2 pt-3">
			{#if multimodalOpen}
				<MultimodalContextComposer
					onReady={handleMultimodalContext}
					onClose={() => (multimodalOpen = false)}
				/>
			{/if}
			{#if coViewerOpen}
				<CoViewerComposer onSubmit={handleCoViewerSubmit} onClose={() => (coViewerOpen = false)} />
			{/if}
			<ChatInput
				onSend={handleSend}
				isThinking={isThinkingOrStreaming}
				doNotRemember={doNotRememberNextMessage}
				onToggleDoNotRemember={() => (doNotRememberNextMessage = !doNotRememberNextMessage)}
				onAddContext={() => {
					coViewerOpen = false;
					multimodalOpen = !multimodalOpen;
				}}
				onAddCoViewer={() => {
					multimodalOpen = false;
					coViewerOpen = !coViewerOpen;
				}}
			/>
		</div>
	</div>

	<label
		for="conversation-history-toggle"
		class="absolute inset-0 z-30 hidden bg-deep-navy/70 backdrop-blur-sm peer-checked:block xl:hidden"
		aria-label="Close conversation history"
	></label>
	<aside
		class="absolute inset-y-0 left-0 z-40 hidden w-[min(320px,88vw)] overflow-hidden rounded-r-3xl border-r border-white/8 shadow-2xl peer-checked:block xl:hidden"
		aria-label="Conversation history"
	>
		<ConversationHistory onSelect={handleSelectChat} />
		<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
		<label
			for="conversation-history-toggle"
			role="button"
			tabindex="0"
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					setHistoryDrawer(false);
				}
			}}
			class="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-gray hover:bg-white/6"
			title="Close conversation history"
			aria-label="Close conversation history"
		>
			<X size={18} aria-hidden="true" />
		</label>
	</aside>

	<!-- Right Drawer (Remembered Context / Memories & Settings Drawer) -->
	{#if drawerOpen}
		<div
			class="absolute inset-y-0 right-0 z-30 w-full sm:w-80 bg-soft-dark-blue border-l border-slate-gray/10 shadow-2xl p-6 flex flex-col rounded-3xl sm:rounded-l-3xl sm:rounded-r-none animate-[slideIn_0.3s_ease-out]"
		>
			<div
				class="flex justify-between items-center pb-4 border-b border-slate-gray/10 mb-6 select-none"
			>
				<h3 class="font-bold text-soft-white text-md">Companion Context</h3>
				<button
					type="button"
					onclick={() => (drawerOpen = false)}
					class="icon-button text-slate-gray"
					title="Close companion context"
					aria-label="Close companion context"
				>
					<X size={18} aria-hidden="true" />
				</button>
			</div>

			<!-- Drawer Scrollable Content -->
			<div class="flex-1 overflow-y-auto space-y-6 pr-1 select-none">
				<!-- Recalled Memories Panel -->
				<div class="space-y-3">
					<div
						class="flex items-center justify-between text-xs font-bold text-slate-gray uppercase tracking-wider"
					>
						<span>Saved Memories ({memoryStore.list.length})</span>
						<a href="/memories" class="text-xs text-cyan-glow hover:underline normal-case">Manage</a
						>
					</div>

					<div class="space-y-2 max-h-[220px] overflow-y-auto">
						{#each memoryStore.list as memory (memory.id)}
							<div
								class="p-3 bg-deep-navy/55 border border-slate-gray/5 rounded-xl text-xs space-y-1"
							>
								<div class="flex justify-between items-center">
									<span class="font-bold text-pale-silver truncate max-w-[120px]"
										>{memory.title}</span
									>
									<span
										class="rounded bg-slate-gray/10 px-1 text-xs uppercase tracking-wide text-slate-gray"
									>
										{memory.type.replace('_', ' ')}
									</span>
								</div>
								<p class="text-xs leading-normal text-slate-gray">{memory.content}</p>
							</div>
						{:else}
							<div
								class="rounded-xl border border-dashed border-slate-gray/10 bg-deep-navy/35 p-3 py-6 text-center text-xs text-slate-gray"
							>
								No memories saved yet. MOONDAY will suggest useful context for your review.
							</div>
						{/each}
					</div>
				</div>

				<!-- AI Settings (Provider & active character specs) -->
				<div class="space-y-4 pt-4 border-t border-slate-gray/10">
					<!-- Provider Selector -->
					<ProviderSelector />

					<!-- Quick companion info -->
					<div class="space-y-1">
						<p class="block text-xs font-semibold text-slate-gray uppercase tracking-wider">
							Active companion
						</p>
						<div
							class="p-3 bg-deep-navy/55 border border-slate-gray/5 rounded-xl flex items-center justify-between"
						>
							<span class="text-xs font-bold text-pale-silver">{activeCompanionName}</span>
							<a href="/settings" class="text-xs text-violet-glow hover:underline">Change</a>
						</div>
					</div>

					<!-- Per-conversation memory switch -->
					<div
						class="flex items-center justify-between p-3 bg-deep-navy/55 border border-slate-gray/5 rounded-xl"
					>
						<div class="flex flex-col">
							<span class="text-xs font-semibold text-pale-silver">Remember in this chat</span>
							<span class="text-xs text-slate-gray">Suggest memories for your review</span>
						</div>
						<button
							onclick={() =>
								activeConv &&
								chatStore.setConversationMemoryExtraction(
									activeConv.id,
									activeConv.memoryExtractionEnabled === false
								)}
							aria-label="Toggle memories for this conversation"
							aria-pressed={activeConv?.memoryExtractionEnabled !== false}
							disabled={!activeConv}
							class="w-9 h-5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer disabled:cursor-not-allowed {activeConv?.memoryExtractionEnabled !==
							false
								? 'bg-violet-glow'
								: 'bg-slate-gray/30'}"
						>
							<div
								class="w-4 h-4 rounded-full bg-soft-white transition-transform duration-300"
								class:translate-x-4={activeConv?.memoryExtractionEnabled !== false}
							></div>
						</button>
					</div>
				</div>
			</div>

			<!-- Drawer Footer Action -->
			<div class="pt-4 border-t border-slate-gray/10 mt-4 select-none">
				<button
					onclick={async () => {
						if (confirm('Clear chat history for this conversation?')) {
							if (activeConv) await chatStore.deleteConversation(activeConv.id);
							drawerOpen = false;
						}
					}}
					class="w-full py-2 px-3 border border-soft-red/20 text-soft-red/80 hover:bg-soft-red/10 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer"
				>
					Clear Chat History
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
</style>
