<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	let activeProvider = $derived(settingsStore.provider);
	let activeModel = $derived(settingsStore.model);

	function select(provider: 'deepseek' | 'claude') {
		settingsStore.setProvider(provider);
	}
</script>

<div class="space-y-3">
	<label
		class="block text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2 select-none"
		>AI Inference Provider</label
	>
	<div class="grid grid-cols-2 gap-3">
		<!-- DeepSeek Provider Selection Button -->
		<button
			type="button"
			onclick={() => select('deepseek')}
			class="flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/60 hover:bg-soft-dark-blue w-full {activeProvider ===
			'deepseek'
				? 'border-cyan-glow ring-1 ring-cyan-glow'
				: 'border-slate-gray/10'}"
		>
			<span class="text-sm font-bold text-soft-white">DeepSeek</span>
			<span class="text-[10px] text-slate-gray mt-1 font-mono">Fast & Reflective</span>
			{#if activeProvider === 'deepseek'}
				<span
					class="mt-2 text-[9px] font-mono text-cyan-glow bg-cyan-glow/10 px-1.5 py-0.5 rounded border border-cyan-glow/20"
				>
					{activeModel}
				</span>
			{/if}
		</button>

		<!-- Anthropic Claude Provider Selection Button -->
		<button
			type="button"
			onclick={() => select('claude')}
			class="flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/60 hover:bg-soft-dark-blue w-full {activeProvider ===
			'claude'
				? 'border-violet-glow ring-1 ring-violet-glow'
				: 'border-slate-gray/10'}"
		>
			<span class="text-sm font-bold text-soft-white">Anthropic Claude</span>
			<span class="text-[10px] text-slate-gray mt-1 font-mono">Deep reasoning</span>
			{#if activeProvider === 'claude'}
				<span
					class="mt-2 text-[9px] font-mono text-violet-glow bg-violet-glow/10 px-1.5 py-0.5 rounded border border-violet-glow/20"
				>
					{activeModel}
				</span>
			{/if}
		</button>
	</div>
</div>
