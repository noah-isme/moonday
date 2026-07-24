<script lang="ts">
	import { CO_VIEWER_MODE_DETAILS, type CoViewerMode } from '$lib/types/co-viewer';

	let { onSubmit, onClose } = $props<{
		onSubmit: (content: string, mode: CoViewerMode) => void;
		onClose: () => void;
	}>();

	let content = $state('');
	let mode = $state<CoViewerMode>('read_the_room');

	function submit() {
		if (!content.trim()) return;
		onSubmit(content.trim(), mode);
	}
</script>

<div
	class="mb-3 rounded-2xl border border-violet-glow/25 bg-violet-glow/5 p-4"
	aria-label="Bring something you saw"
>
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="text-sm font-semibold text-pale-silver">Bring something you saw</h2>
			<p class="mt-1 text-xs text-slate-gray">
				Paste a post, caption, comment, or URL. It stays in this conversation and is not saved as a
				memory automatically.
			</p>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-lg px-2 py-1 text-xs text-slate-gray hover:text-pale-silver">Close</button
		>
	</div>

	<textarea
		bind:value={content}
		rows="4"
		maxlength="5000"
		placeholder="Paste text or a link here…"
		class="mt-3 w-full resize-y rounded-xl border border-slate-gray/15 bg-deep-navy/70 p-3 text-sm text-soft-white outline-none placeholder:text-slate-gray focus:border-violet-glow/60"
	></textarea>

	<div class="mt-3 flex flex-wrap gap-2">
		{#each Object.entries(CO_VIEWER_MODE_DETAILS) as [key, detail] (key)}
			<button
				type="button"
				onclick={() => (mode = key as CoViewerMode)}
				class="rounded-lg border px-2.5 py-1.5 text-xs transition-colors {mode === key
					? 'border-violet-glow/60 bg-violet-glow/15 text-pale-silver'
					: 'border-slate-gray/15 text-slate-gray hover:border-slate-gray/35 hover:text-pale-silver'}"
				title={detail.description}>{detail.label}</button
			>
		{/each}
	</div>
	<p class="mt-2 text-[11px] text-slate-gray">{CO_VIEWER_MODE_DETAILS[mode].description}</p>
	<div class="mt-3 flex justify-end gap-2">
		<button
			type="button"
			onclick={onClose}
			class="rounded-lg px-3 py-2 text-xs text-slate-gray hover:text-pale-silver">Cancel</button
		>
		<button
			type="button"
			onclick={submit}
			disabled={!content.trim()}
			class="rounded-lg bg-violet-glow px-3 py-2 text-xs font-semibold text-deep-navy disabled:opacity-45"
			>Ask MOONDAY</button
		>
	</div>
</div>
