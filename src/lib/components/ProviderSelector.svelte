<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';

	let activeProvider = $derived(settingsStore.provider);
	let activeModel = $derived(settingsStore.model);

	function select(provider: 'deepseek' | 'claude' | 'groq') {
		const changed = settingsStore.provider !== provider;
		settingsStore.setProvider(provider);
		if (changed) {
			const name = provider === 'groq' ? 'Groq' : provider[0].toUpperCase() + provider.slice(1);
			uiStore.setNotice(`${name} selected for new replies.`, 'info');
		}
	}
</script>

<div class="space-y-3">
	<p class="block text-xs font-semibold text-slate-gray uppercase tracking-wider mb-2 select-none">
		AI Inference Provider
	</p>
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<!-- DeepSeek Provider Selection Button -->
		<button
			type="button"
			onclick={() => select('deepseek')}
			class="flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/60 hover:bg-soft-dark-blue w-full {activeProvider ===
			'deepseek'
				? 'border-cyan-glow ring-1 ring-cyan-glow'
				: 'border-slate-gray/10'}"
		>
			<span class="text-xs font-bold text-soft-white">DeepSeek</span>
			<span class="text-[9px] text-slate-gray mt-1 font-mono">Fast & Reflective</span>
			{#if activeProvider === 'deepseek'}
				<span
					class="mt-2 text-[8px] font-mono text-cyan-glow bg-cyan-glow/10 px-1.5 py-0.5 rounded border border-cyan-glow/20"
				>
					{activeModel}
				</span>
			{/if}
		</button>

		<!-- Anthropic Claude Provider Selection Button -->
		<button
			type="button"
			onclick={() => select('claude')}
			class="flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/60 hover:bg-soft-dark-blue w-full {activeProvider ===
			'claude'
				? 'border-violet-glow ring-1 ring-violet-glow'
				: 'border-slate-gray/10'}"
		>
			<span class="text-xs font-bold text-soft-white font-sans truncate w-full">Claude</span>
			<span class="text-[9px] text-slate-gray mt-1 font-mono">Deep reasoning</span>
			{#if activeProvider === 'claude'}
				<span
					class="mt-2 text-[8px] font-mono text-violet-glow bg-violet-glow/10 px-1.5 py-0.5 rounded border border-violet-glow/20"
				>
					{activeModel}
				</span>
			{/if}
		</button>

		<!-- Groq Provider Selection Button -->
		<button
			type="button"
			onclick={() => select('groq')}
			class="flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300 cursor-pointer select-none bg-soft-dark-blue/60 hover:bg-soft-dark-blue w-full {activeProvider ===
			'groq'
				? 'border-moon-yellow ring-1 ring-moon-yellow'
				: 'border-slate-gray/10'}"
		>
			<span class="text-xs font-bold text-soft-white">Groq LLaMA</span>
			<span class="text-[9px] text-slate-gray mt-1 font-mono">Ultra-fast inference</span>
			{#if activeProvider === 'groq'}
				<span
					class="mt-2 text-[8px] font-mono text-moon-yellow bg-moon-yellow/10 px-1.5 py-0.5 rounded border border-moon-yellow/20 truncate max-w-full"
				>
					{activeModel}
				</span>
			{/if}
		</button>
	</div>
</div>
