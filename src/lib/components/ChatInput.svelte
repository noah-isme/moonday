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
	class="relative rounded-3xl border border-white/8 bg-soft-dark-blue/80 p-2.5 shadow-[0_16px_44px_rgba(0,0,0,0.16)] transition-colors focus-within:border-violet-glow/35"
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
				class="composer-icon {doNotRemember ? 'active-private' : ''}"
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
				class="composer-icon {chatStore.isWebSearchEnabled ? 'active-research' : ''}"
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
				class="flex h-10 w-10 items-center justify-center rounded-full bg-violet-glow text-deep-navy transition-colors hover:bg-violet-glow/90 disabled:bg-deep-navy/50 disabled:text-slate-gray"
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
			class="absolute bottom-[calc(100%-0.25rem)] left-10 z-40 grid min-w-48 gap-1 rounded-2xl border border-white/10 bg-soft-dark-blue p-1.5 text-xs shadow-2xl"
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
		background: rgb(34 211 238 / 0.12);
		color: var(--color-cyan-glow);
	}

	.active-research {
		background: rgb(167 139 250 / 0.15);
		color: var(--color-violet-glow);
	}
</style>
