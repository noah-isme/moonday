<script lang="ts">
	import { characterStore, CHARACTERS } from '$lib/stores/character.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';

	let { onSelect } = $props<{
		onSelect?: (id: string) => void;
	}>();

	function handleSelect(id: string) {
		const changed = characterStore.activeId !== id;
		characterStore.selectCharacter(id);
		if (changed) uiStore.setNotice(`${characterStore.activeCharacter.name} is now your companion.`);
		if (onSelect) {
			onSelect(id);
		}
	}

	// Helper to generate visual dots for levels
	function renderDots(val: number) {
		return '●'.repeat(val) + '○'.repeat(Math.max(0, 5 - val));
	}
</script>

<div class="space-y-4">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		{#each CHARACTERS as character (character.id)}
			<button
				type="button"
				onclick={() => handleSelect(character.id)}
				class="flex flex-col text-left p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/80 hover:bg-soft-dark-blue w-full {characterStore.activeId ===
				character.id
					? 'border-violet-glow ring-1 ring-violet-glow'
					: 'border-slate-gray/10'}"
			>
				<!-- Title & Selection Check -->
				<div class="flex items-center justify-between w-full mb-2">
					<h3 class="font-bold text-soft-white flex items-center gap-2">
						<span>{character.name}</span>
						{#if characterStore.activeId === character.id}
							<span class="w-1.5 h-1.5 rounded-full bg-violet-glow animate-pulse"></span>
						{/if}
					</h3>
					<span
						class="text-[10px] uppercase font-semibold tracking-wider text-slate-gray bg-deep-navy/50 px-2 py-0.5 rounded border border-slate-gray/10"
					>
						{character.tone}
					</span>
				</div>

				<!-- Description -->
				<p class="text-xs text-pale-silver leading-relaxed mb-4 flex-1">
					{character.description}
				</p>

				<!-- Traits Metrics Panel -->
				<div
					class="w-full space-y-1.5 pt-3 border-t border-slate-gray/10 text-[10px] text-slate-gray font-mono select-none"
				>
					<div class="flex justify-between items-center">
						<span>Emotional Warmth</span>
						<span class="text-yellow-200">{renderDots(character.emotionalWarmth)}</span>
					</div>
					<div class="flex justify-between items-center">
						<span>Humor Level</span>
						<span class="text-cyan-400">{renderDots(character.humorLevel)}</span>
					</div>
					<div class="flex justify-between items-center">
						<span>Sarcasm Level</span>
						<span class="text-soft-red">{renderDots(character.sarcasmLevel)}</span>
					</div>
					<div class="flex justify-between items-center">
						<span>Moral Directness</span>
						<span class="text-violet-glow">{renderDots(character.moralDirectness)}</span>
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>
