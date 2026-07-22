<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { memoryStore } from '$lib/stores/memory.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import ChatBubble from '$lib/components/ChatBubble.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import CharacterSelector from '$lib/components/CharacterSelector.svelte';
	import ProviderSelector from '$lib/components/ProviderSelector.svelte';

	let scrollContainer = $state<HTMLDivElement | null>(null);
	let drawerOpen = $state(false);
	let dailyPromptDismissed = $state(false);
	let renameId = $state<string | null>(null);
	let renameValue = $state('');

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
	let hasMessagesFromToday = $derived(
		messages.some(
			(message) => new Date(message.createdAt).toDateString() === new Date().toDateString()
		)
	);
	let showDailyContinuity = $derived(
		!dailyPromptDismissed &&
			!hasMessagesFromToday &&
			messages.some((message) => message.role === 'user')
	);

	const starterPrompts = [
		'Unload what is on my mind.',
		'Help me plan one small next step.',
		'Help me reflect on today.',
		'I just want you to listen.'
	];

	function focus(node: HTMLInputElement) {
		node.focus();
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

	// Trigger voice synthesis on new assistant message
	let lastMessageCount = $state(0);
	$effect(() => {
		const currentCount = messages.length;
		if (currentCount > lastMessageCount) {
			const lastMsg = messages[currentCount - 1];
			if (lastMsg && lastMsg.role === 'assistant' && settingsStore.voiceOutputEnabled) {
				voiceStore.speak(lastMsg.content);
			}
		}
		lastMessageCount = currentCount;
	});

	onMount(() => {
		scrollToBottom('auto');
	});

	onDestroy(() => {
		// Stop any speech synthesis when leaving chat
		voiceStore.stopSpeaking();
	});

	async function handleSend(text: string) {
		voiceStore.stopSpeaking(); // Stop speaking user's current speech if they type/send new message
		await chatStore.sendMessage(text);
	}

	function switchProvider() {
		settingsStore.setProvider(settingsStore.provider === 'deepseek' ? 'groq' : 'deepseek');
	}

	async function retryWithoutWebSearch() {
		if (chatStore.isWebSearchEnabled) chatStore.toggleWebSearch();
		await chatStore.retryLastMessage();
	}

	async function handleCreateChat() {
		await chatStore.createNewConversation();
		scrollToBottom('auto');
	}

	function handleSelectChat(id: string) {
		chatStore.selectConversation(id);
		scrollToBottom('auto');
	}

	function startRename(id: string, title: string) {
		renameId = id;
		renameValue = title;
	}

	async function saveRename() {
		if (renameId && renameValue.trim()) {
			const renamed = await chatStore.updateConversationTitle(renameId, renameValue.trim());
			if (renamed) renameId = null;
		}
	}

	async function handleRenameKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			await saveRename();
		} else if (event.key === 'Escape') {
			renameId = null;
		}
	}

	// Dynamic title based on active companion
	let activeCompanionName = $derived(characterStore.activeCharacter.name);
</script>

<div
	class="flex-1 flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-60px)] min-h-0 relative"
>
	<!-- Left sidebar (Conversations history selector) on Desktop -->
	<div
		class="hidden lg:flex flex-col w-64 bg-soft-dark-blue/40 border border-slate-gray/10 rounded-3xl p-4 flex-shrink-0 min-h-0"
	>
		<div class="flex items-center justify-between mb-4 select-none">
			<span class="text-xs font-bold text-slate-gray uppercase tracking-wider">Reflections Log</span
			>
			<button
				onclick={handleCreateChat}
				class="text-xs text-violet-glow hover:text-violet-glow/85 font-semibold flex items-center gap-1 cursor-pointer"
				title="Create a new conversation session"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2.5"
					stroke="currentColor"
					class="w-3.5 h-3.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				<span>New</span>
			</button>
		</div>

		<!-- List of Conversations -->
		<div class="flex-1 overflow-y-auto space-y-1 pr-1">
			{#each chatStore.conversations as conv}
				<div
					class="group flex items-center justify-between p-2.5 rounded-xl text-xs transition-all duration-300 w-full {chatStore.activeId ===
					conv.id
						? 'bg-soft-dark-blue border border-slate-gray/15 text-soft-white'
						: 'text-slate-gray hover:bg-soft-dark-blue/30'}"
				>
					{#if renameId === conv.id}
						<input
							type="text"
							bind:value={renameValue}
							onblur={saveRename}
							onkeydown={handleRenameKeyDown}
							class="flex-1 bg-deep-navy border border-violet-glow/40 rounded px-1.5 py-0.5 text-xs text-soft-white outline-none focus:ring-1 focus:ring-violet-glow"
							/* eslint-disable-next-line svelte/valid-compile */
							use:focus
						/>
					{:else}
						<button
							onclick={() => handleSelectChat(conv.id)}
							class="flex-1 text-left truncate font-medium hover:text-pale-silver cursor-pointer pr-1"
							title={conv.title}
						>
							{conv.title}
						</button>

						<!-- Conversation Actions -->
						<div
							class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
						>
							<button
								onclick={() => startRename(conv.id, conv.title)}
								class="p-1 hover:text-cyan-glow text-slate-gray cursor-pointer"
								title="Rename conversation"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
									class="w-3 h-3"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
									/>
								</svg>
							</button>
							{#if chatStore.conversations.length > 1}
								<button
									onclick={async () => await chatStore.deleteConversation(conv.id)}
									class="p-1 hover:text-soft-red text-slate-gray cursor-pointer"
									title="Delete session"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="w-3 h-3"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
										/>
									</svg>
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<p class="text-xs text-slate-gray text-center mt-4 select-none">No active sessions.</p>
			{/each}
		</div>
	</div>

	<!-- Center Chat Message Window -->
	<div
		class="flex-1 flex flex-col bg-soft-dark-blue/15 border border-slate-gray/10 rounded-3xl p-4 md:p-6 min-h-0"
	>
		<!-- Chat Header Toolbar -->
		<div
			class="flex items-center justify-between pb-3 border-b border-slate-gray/10 mb-4 select-none"
		>
			<div class="flex items-center gap-2">
				<label class="sr-only" for="response-language">Response language</label>
				<select
					id="response-language"
					value={settingsStore.responseLanguage}
					onchange={(event) =>
						settingsStore.setResponseLanguage(
							(event.currentTarget as HTMLSelectElement).value as 'auto' | 'en' | 'id'
						)}
					class="max-w-24 sm:max-w-none rounded-lg border border-slate-gray/15 bg-deep-navy/50 px-2 py-1.5 text-xs text-pale-silver outline-none focus:border-violet-glow/60"
					title="Choose MOONDAY's response language"
				>
					<option value="auto">Auto</option>
					<option value="en">English</option>
					<option value="id">Bahasa Indonesia</option>
				</select>
				<h2 class="text-sm font-bold text-soft-white truncate max-w-[200px] md:max-w-sm">
					{activeConv?.title || `Chatting with ${activeCompanionName}`}
				</h2>
			</div>

			<div class="flex items-center gap-2">
				<!-- Speaker mute/unmute button indicator -->
				<button
					type="button"
					onclick={() => settingsStore.toggleVoiceOutput()}
					class="p-2 rounded-xl text-slate-gray hover:text-pale-silver hover:bg-soft-dark-blue/40 transition-all duration-300 cursor-pointer"
					title={settingsStore.voiceOutputEnabled
						? 'Mute AI voice responses'
						: 'Unmute AI voice responses'}
				>
					{#if settingsStore.voiceOutputEnabled}
						<!-- Volume High Icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="2"
							stroke="currentColor"
							class="w-4 h-4 text-cyan-glow"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
							/>
						</svg>
					{:else}
						<!-- Volume Mute Icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="2"
							stroke="currentColor"
							class="w-4 h-4"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
							/>
						</svg>
					{/if}
				</button>

				<!-- Toggle drawer button -->
				<button
					type="button"
					onclick={() => (drawerOpen = !drawerOpen)}
					class="p-2 rounded-xl text-slate-gray hover:text-pale-silver hover:bg-soft-dark-blue/40 transition-all duration-300 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
					title="Toggle memories & configurations drawer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
						/>
					</svg>
					<span class="hidden sm:inline">Context & Settings</span>
				</button>
			</div>
		</div>

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
					class="font-bold hover:text-soft-white cursor-pointer">×</button
				>
			</div>
		{/if}

		{#if chatStore.usedMemories.length > 0}
			<div
				class="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-cyan-glow/15 bg-cyan-glow/5 px-3 py-2 text-[10px] text-slate-gray"
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
							class="hover:text-soft-white">×</button
						>
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

		<!-- Scrollable Messages Container -->
		<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-1 scroll-smooth">
			{#if showDailyContinuity}
				<div
					class="mx-auto mb-4 max-w-lg rounded-2xl border border-violet-glow/20 bg-violet-glow/5 p-4 text-center"
				>
					<p class="text-xs font-semibold text-pale-silver">A new day, a gentle choice</p>
					<p class="mt-1 text-xs text-slate-gray">
						Would you like to continue yesterday’s thread, reflect, or begin fresh?
					</p>
					<div class="mt-3 flex flex-wrap justify-center gap-2 text-xs">
						<button
							type="button"
							onclick={() => handleSend('Let’s continue where we left off yesterday.')}
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
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-12 h-12 mb-2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 3v1.5M12 18.75V21m-7.5-9h1.5m14.25 0h1.5m-15.03-6.53 1.06 1.06m11.94 11.94 1.06 1.06m-12.06 0-1.06 1.06m11.94-11.94-1.06 1.06M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
						/>
					</svg>
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
						{#each starterPrompts as prompt}
							<button
								type="button"
								onclick={() => handleSend(prompt)}
								class="w-full px-4 py-3 rounded-2xl bg-deep-navy/40 border border-slate-gray/10 text-xs text-pale-silver hover:border-violet-glow/40 hover:bg-violet-glow/10 transition-colors cursor-pointer"
							>
								{prompt}
							</button>
						{/each}
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
		<div class="pt-4 border-t border-slate-gray/10 mt-2">
			<ChatInput onSend={handleSend} isThinking={isThinkingOrStreaming} />
		</div>
	</div>

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
					onclick={() => (drawerOpen = false)}
					class="p-1 text-slate-gray hover:text-soft-white cursor-pointer"
					title="Close drawer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="w-5 h-5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
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
						<a href="/memories" class="text-[10px] text-cyan-glow hover:underline normal-case"
							>Manage</a
						>
					</div>

					<div class="space-y-2 max-h-[220px] overflow-y-auto">
						{#each memoryStore.list as memory}
							<div
								class="p-3 bg-deep-navy/55 border border-slate-gray/5 rounded-xl text-xs space-y-1"
							>
								<div class="flex justify-between items-center">
									<span class="font-bold text-pale-silver truncate max-w-[120px]"
										>{memory.title}</span
									>
									<span
										class="text-[8px] bg-slate-gray/10 text-slate-gray px-1 rounded uppercase tracking-wide"
									>
										{memory.type.replace('_', ' ')}
									</span>
								</div>
								<p class="text-slate-gray leading-normal text-[11px]">{memory.content}</p>
							</div>
						{:else}
							<div
								class="p-3 bg-deep-navy/35 border border-dashed border-slate-gray/10 rounded-xl text-center text-[11px] text-slate-gray py-6"
							>
								No memories saved yet. MOONDAY automatically extracts memories from chats.
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
							<a href="/settings" class="text-[10px] text-violet-glow hover:underline">Change</a>
						</div>
					</div>

					<!-- Memory switch toggler -->
					<div
						class="flex items-center justify-between p-3 bg-deep-navy/55 border border-slate-gray/5 rounded-xl"
					>
						<div class="flex flex-col">
							<span class="text-xs font-semibold text-pale-silver">Memory Extraction</span>
							<span class="text-[9px] text-slate-gray">Enable AI to save facts</span>
						</div>
						<button
							onclick={() => settingsStore.toggleMemoryExtraction()}
							aria-label="Toggle memory extraction"
							aria-pressed={settingsStore.memoryExtractionEnabled}
							class="w-9 h-5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer {settingsStore.memoryExtractionEnabled
								? 'bg-violet-glow'
								: 'bg-slate-gray/30'}"
						>
							<div
								class="w-4 h-4 rounded-full bg-soft-white transition-transform duration-300"
								class:translate-x-4={settingsStore.memoryExtractionEnabled}
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
