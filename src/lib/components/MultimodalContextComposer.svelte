<script lang="ts">
	import type { ImageAttachment, UrlContext } from '$lib/types/multimodal';

	let { onReady, onClose } = $props<{
		onReady: (context: { images: ImageAttachment[]; urlContext?: UrlContext }) => void;
		onClose: () => void;
	}>();

	let images = $state<ImageAttachment[]>([]);
	let url = $state('');
	let preview = $state<UrlContext | null>(null);
	let previewError = $state<string | null>(null);
	let isPreviewing = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	function readFile(file: File) {
		if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
			previewError = 'Choose a PNG, JPEG, WebP, or GIF image.';
			return;
		}
		if (file.size > 3 * 1024 * 1024) {
			previewError = 'Images must be 3 MB or smaller.';
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			images = [...images, { name: file.name, mediaType: file.type as ImageAttachment['mediaType'], dataUrl: String(reader.result) }].slice(0, 2);
			previewError = null;
		};
		reader.readAsDataURL(file);
	}

	function handleFiles(event: Event) {
		for (const file of Array.from((event.currentTarget as HTMLInputElement).files || [])) readFile(file);
		(event.currentTarget as HTMLInputElement).value = '';
	}

	async function fetchPreview() {
		if (!url.trim()) return;
		isPreviewing = true;
		previewError = null;
		try {
			const response = await fetch('/api/context-preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, confirmed: true })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error?.message || 'Preview unavailable.');
			preview = data.preview;
		} catch (error) {
			previewError = error instanceof Error ? error.message : 'Preview unavailable.';
		} finally {
			isPreviewing = false;
		}
	}
</script>

<div class="mb-3 rounded-2xl border border-cyan-glow/25 bg-cyan-glow/5 p-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="text-sm font-semibold text-pale-silver">Add visual or link context</h2>
			<p class="mt-1 text-xs text-slate-gray">Images and previews are sent only for your next response. They are not saved by MOONDAY, remembered, or included in future chat context.</p>
		</div>
		<button type="button" onclick={onClose} class="rounded-lg px-2 py-1 text-xs text-slate-gray hover:text-pale-silver">Close</button>
	</div>

	<div class="mt-3 flex flex-wrap gap-2">
		<input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden" onchange={handleFiles} />
		<button type="button" onclick={() => fileInput?.click()} class="rounded-lg border border-slate-gray/15 px-3 py-2 text-xs text-pale-silver hover:border-cyan-glow/50">Add screenshot or image</button>
		<span class="self-center text-[11px] text-slate-gray">PNG, JPEG, WebP, GIF · up to 3 MB · max 2</span>
	</div>
	{#if images.length}
		<div class="mt-3 flex flex-wrap gap-2">
			{#each images as image, index}
				<div class="relative overflow-hidden rounded-xl border border-slate-gray/15 bg-deep-navy/60">
					<img src={image.dataUrl} alt="Selected context: {image.name}" class="h-20 w-20 object-cover" />
					<button type="button" onclick={() => (images = images.filter((_, itemIndex) => itemIndex !== index))} class="absolute right-1 top-1 rounded bg-deep-navy/80 px-1.5 py-0.5 text-[10px] text-soft-white">Remove</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="mt-4 border-t border-slate-gray/10 pt-3">
		<label class="text-xs font-semibold text-pale-silver" for="context-url">Link preview</label>
		<div class="mt-1.5 flex gap-2">
			<input id="context-url" bind:value={url} placeholder="https://example.com/post" class="min-w-0 flex-1 rounded-xl border border-slate-gray/15 bg-deep-navy/70 px-3 py-2 text-xs text-soft-white outline-none focus:border-cyan-glow/50" />
			<button type="button" onclick={fetchPreview} disabled={!url.trim() || isPreviewing} class="rounded-xl border border-cyan-glow/35 px-3 py-2 text-xs text-cyan-glow disabled:opacity-45">{isPreviewing ? 'Fetching…' : 'Fetch preview'}</button>
		</div>
		<p class="mt-1.5 text-[11px] text-slate-gray">Fetching sends this URL to MOONDAY’s preview service. Only public http(s) links are allowed.</p>
		{#if preview}
			<div class="mt-2 rounded-xl border border-slate-gray/10 bg-deep-navy/45 p-3">
				<div class="flex items-start justify-between gap-2"><p class="text-xs font-semibold text-pale-silver">{preview.title}</p><button type="button" onclick={() => (preview = null)} class="text-[11px] text-slate-gray hover:text-pale-silver">Remove</button></div>
				<p class="mt-1 line-clamp-3 text-[11px] text-slate-gray">{preview.content}</p>
			</div>
		{/if}
	</div>
	{#if previewError}<p class="mt-2 text-xs text-soft-red">{previewError}</p>{/if}
	<div class="mt-4 flex justify-end gap-2"><button type="button" onclick={onClose} class="rounded-lg px-3 py-2 text-xs text-slate-gray">Cancel</button><button type="button" onclick={() => onReady({ images, urlContext: preview || undefined })} disabled={!images.length && !preview} class="rounded-lg bg-cyan-glow px-3 py-2 text-xs font-semibold text-deep-navy disabled:opacity-45">Use for next response</button></div>
</div>
