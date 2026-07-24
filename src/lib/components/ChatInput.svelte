<script lang="ts">
	import VoiceButton from './VoiceButton.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { BrainCircuit, Globe2, LoaderCircle, Paperclip, Send, Sparkles, X } from 'lucide-svelte';

	let {
		onSend,
		isThinking = false,
		doNotRemember = false,
		onToggleDoNotRemember,
		onAddContext,
		onAddCoViewer
	} = $props<{
		onSend: (text: string) => void;
		isThinking?: boolean;
		doNotRemember?: boolean;
		onToggleDoNotRemember?: () => void;
		onAddContext?: () => void;
		onAddCoViewer?: () => void;
	}>();

	let textValue = $state('');
	let contextMenuOpen = $state(false);

	// Handle sending messages
	function handleSend() {
		if (!textValue.trim() || isThinking) return;
		onSend(textValue);
		textValue = '';
	}

	// Submit on Enter key (without Shift)
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	// Update textValue with microphone transcripts in real-time
	function handleTranscript(transcript: string) {
		textValue = transcript;
	}

	function discardTranscript() {
		voiceStore.stopListening();
		voiceStore.transcript = '';
		textValue = '';
	}
</script>

<div
	class="relative rounded-3xl border border-cyan-glow/12 bg-[linear-gradient(145deg,rgba(16,42,40,0.96),rgba(8,31,30,0.96))] p-2.5 shadow-[0_16px_44px_rgba(0,0,0,0.2)] transition-colors focus-within:border-cyan-glow/40 focus-within:shadow-[0_0_30px_rgba(103,230,210,0.07)]"
>
	{#if voiceStore.isListening || voiceStore.isTranscribing || voiceStore.transcript.trim() || voiceStore.isPreparingSpeech}
		<div
			class="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-deep-navy/35 px-3 py-2 text-xs"
			aria-live="polite"
		>
			<p
				class="flex items-center gap-2 {voiceStore.isListening
					? 'text-cyan-glow'
					: 'text-slate-gray'}"
			>
				<Sparkles size={14} aria-hidden="true" />
				{voiceStore.isPreparingSpeech
					? 'MOONDAY is preparing your voice…'
					: voiceStore.isTranscribing
						? 'Transcribing your recording…'
						: voiceStore.isListening
							? voiceStore.recognitionState === 'starting'
								? 'Starting microphone…'
								: 'Listening… tap the microphone when you are done.'
							: 'Transcript ready to review.'}
			</p>
			{#if voiceStore.transcript.trim() && !voiceStore.isListening}
				<button
					type="button"
					onclick={discardTranscript}
					class="text-slate-gray hover:text-pale-silver"
				>
					Discard
				</button>
			{/if}
		</div>
	{/if}

	<div class="flex items-end gap-1.5">
		<div class="flex shrink-0 items-center gap-1">
			<VoiceButton onTranscript={handleTranscript} />
			<button
				type="button"
				onclick={() => (contextMenuOpen = !contextMenuOpen)}
				class="composer-icon"
				title="Add an image, link, or shared context"
				aria-label="Add an image, link, or shared context"
				aria-expanded={contextMenuOpen}
			>
				<Paperclip size={19} aria-hidden="true" />
			</button>
		</div>

		<textarea
			bind:value={textValue}
			onkeydown={handleKeyDown}
			placeholder={voiceStore.isListening ? 'Listening…' : 'Share a thought…'}
			disabled={isThinking}
			rows="1"
			class="max-h-36 min-h-11 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-base leading-6 text-soft-white outline-none placeholder:text-slate-gray disabled:opacity-50"
		></textarea>

		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				onclick={onToggleDoNotRemember}
				class="composer-icon mobile-secondary-tool {doNotRemember ? 'active-private' : ''}"
				title={doNotRemember
					? 'Memory suggestions disabled for this message'
					: 'Do not remember this message'}
				aria-label={doNotRemember
					? 'Allow memory suggestions for this message'
					: 'Do not remember this message'}
				aria-pressed={doNotRemember}
			>
				<BrainCircuit size={18} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={() => chatStore.toggleWebSearch()}
				class="composer-icon mobile-secondary-tool {chatStore.isWebSearchEnabled
					? 'active-research'
					: ''}"
				title={chatStore.isWebSearchEnabled ? 'Web research enabled' : 'Enable web research'}
				aria-label={chatStore.isWebSearchEnabled ? 'Disable web research' : 'Enable web research'}
				aria-pressed={chatStore.isWebSearchEnabled}
			>
				<Globe2 size={19} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={handleSend}
				disabled={!textValue.trim() || isThinking}
				class="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-glow/30 bg-[linear-gradient(135deg,#126f65,#245a55)] text-soft-white shadow-[0_0_22px_rgba(7,80,71,0.2)] transition-all hover:scale-105 disabled:scale-100 disabled:bg-deep-navy/50 disabled:text-slate-gray disabled:shadow-none"
				title="Send message"
				aria-label="Send message"
			>
				{#if isThinking}
					<LoaderCircle size={19} class="animate-spin" aria-hidden="true" />
				{:else}
					<Send size={19} aria-hidden="true" />
				{/if}
			</button>
		</div>
	</div>

	{#if contextMenuOpen}
		<div
			class="absolute bottom-[calc(100%-0.25rem)] left-10 z-40 grid min-w-48 gap-1 rounded-2xl border border-cyan-glow/12 bg-soft-dark-blue p-1.5 text-xs shadow-2xl"
			role="menu"
			aria-label="Add context"
		>
			<button
				type="button"
				role="menuitem"
				onclick={() => {
					contextMenuOpen = false;
					onAddContext?.();
				}}
				class="rounded-xl px-3 py-2.5 text-left text-pale-silver hover:bg-white/6"
			>
				Add image or link
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => {
					contextMenuOpen = false;
					onAddCoViewer?.();
				}}
				class="rounded-xl px-3 py-2.5 text-left text-pale-silver hover:bg-white/6"
			>
				Bring something you saw
			</button>
		</div>
	{/if}

	{#if voiceStore.errorMessage}
		<div
			class="mt-2 flex items-center justify-between gap-3 px-3 text-xs text-soft-red"
			role="alert"
		>
			<span>{voiceStore.errorMessage}</span>
			<button
				type="button"
				onclick={() => (voiceStore.errorMessage = null)}
				class="text-slate-gray hover:text-pale-silver"
				aria-label="Dismiss voice error"
			>
				<X size={15} aria-hidden="true" />
			</button>
		</div>
	{/if}
</div>

<style>
	.composer-icon {
		display: inline-flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: var(--color-slate-gray);
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}

	.composer-icon:hover {
		background: rgb(255 255 255 / 0.06);
		color: var(--color-pale-silver);
	}

	.active-private {
		background: rgb(103 230 210 / 0.12);
		color: var(--color-cyan-glow);
	}

	.active-research {
		background: rgb(173 156 255 / 0.15);
		color: var(--color-violet-glow);
	}

	@media (max-width: 639px) {
		.mobile-secondary-tool {
			display: none;
		}
	}
</style>
