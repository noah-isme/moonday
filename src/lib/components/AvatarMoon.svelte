<script lang="ts">
	// Props for states: 'idle', 'listening', 'thinking', 'speaking', 'happy', 'concerned', 'sleepy'
	let { state = 'idle' } = $props<{
		state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'concerned' | 'sleepy';
	}>();

	// Color configurations for the moon glow based on mood state
	const colors = {
		idle: {
			glow: 'rgba(167, 139, 250, 0.25)', // soft violet
			moon: 'from-amber-100 to-amber-200',
			border: 'border-violet-500/20'
		},
		listening: {
			glow: 'rgba(34, 211, 238, 0.45)', // pulsing cyan
			moon: 'from-cyan-100 to-cyan-300',
			border: 'border-cyan-400/50'
		},
		thinking: {
			glow: 'rgba(139, 92, 246, 0.4)', // purple
			moon: 'from-purple-100 to-indigo-300',
			border: 'border-purple-400/30'
		},
		speaking: {
			glow: 'rgba(254, 240, 138, 0.4)', // moon yellow
			moon: 'from-yellow-100 to-yellow-300',
			border: 'border-yellow-400/40'
		},
		happy: {
			glow: 'rgba(254, 240, 138, 0.5)', // warm gold
			moon: 'from-yellow-200 to-amber-300',
			border: 'border-yellow-300/50'
		},
		concerned: {
			glow: 'rgba(96, 165, 250, 0.35)', // soft blue
			moon: 'from-sky-100 to-blue-300',
			border: 'border-blue-400/30'
		},
		sleepy: {
			glow: 'rgba(148, 163, 184, 0.15)', // dimmed slate
			moon: 'from-slate-300 to-slate-500',
			border: 'border-slate-500/10'
		}
	};

	let colorConfig = $derived(colors[state as keyof typeof colors] || colors.idle);
</script>

<div
	class="relative flex items-center justify-center w-full h-full max-w-[200px] max-h-[200px] aspect-square mx-auto"
>
	<!-- Background glow ring -->
	<div
		class="absolute inset-0 rounded-full transition-all duration-700 ease-in-out blur-xl opacity-80"
		style="background-color: {colorConfig.glow}; transform: scale({state === 'listening'
			? 1.15
			: state === 'speaking'
				? 1.08
				: 1.0});"
	></div>

	<!-- Outer pulsating ring (when active) -->
	{#if state === 'listening'}
		<div
			class="absolute inset-[-8px] rounded-full border border-cyan-400/30 animate-pulse pointer-events-none"
		></div>
		<div
			class="absolute inset-[-16px] rounded-full border border-cyan-400/15 animate-ping opacity-30 pointer-events-none"
		></div>
	{:else if state === 'thinking'}
		<div
			class="absolute inset-[-6px] rounded-full border border-dashed border-purple-500/30 animate-[spin_12s_linear_infinite] pointer-events-none"
		></div>
	{/if}

	<!-- Main Moon Body -->
	<svg
		viewBox="0 0 100 100"
		class="w-full h-full relative z-10 transition-transform duration-500 ease-in-out cursor-pointer select-none"
		class:animate-float={state !== 'sleepy'}
		class:animate-[pulse_4s_ease-in-out_infinite]={state === 'sleepy'}
		style="filter: drop-shadow(0 10px 15px rgba(0,0,0,0.4));"
	>
		<!-- Gradient Definitions -->
		<defs>
			<radialGradient id="moonGrad" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
				<stop offset="0%" stop-color="#ffffff" />
				{#if state === 'sleepy'}
					<stop offset="70%" stop-color="#94a3b8" />
					<stop offset="100%" stop-color="#475569" />
				{:else if state === 'happy' || state === 'speaking'}
					<stop offset="70%" stop-color="#fef08a" />
					<stop offset="100%" stop-color="#eab308" />
				{:else if state === 'listening'}
					<stop offset="75%" stop-color="#cffafe" />
					<stop offset="100%" stop-color="#0891b2" />
				{:else if state === 'concerned'}
					<stop offset="75%" stop-color="#e0f2fe" />
					<stop offset="100%" stop-color="#2563eb" />
				{:else if state === 'thinking'}
					<stop offset="75%" stop-color="#f3e8ff" />
					<stop offset="100%" stop-color="#7c3aed" />
				{:else}
					<stop offset="75%" stop-color="#fef3c7" />
					<stop offset="100%" stop-color="#d97706" />
				{/if}
			</radialGradient>

			<radialGradient id="shadowGrad" cx="70%" cy="30%" r="40%">
				<stop offset="0%" stop-color="#000000" stop-opacity="0" />
				<stop offset="100%" stop-color="#000000" stop-opacity="0.5" />
			</radialGradient>
		</defs>

		<!-- Base Moon Sphere -->
		<circle cx="50" cy="50" r="45" fill="url(#moonGrad)" />

		<!-- Craters (subtle depth indicators) -->
		<g class="opacity-15 transition-opacity duration-500" fill="#475569">
			<circle cx="30" cy="35" r="5" />
			<circle cx="28" cy="33" r="3" opacity="0.5" />

			<circle cx="70" cy="40" r="7" />
			<circle cx="67" cy="38" r="4" opacity="0.5" />

			<circle cx="40" cy="72" r="6" />

			<circle cx="62" cy="70" r="4" />
		</g>

		<!-- Dark side shadow (gives a 3D crescent depth) -->
		<circle cx="50" cy="50" r="45" fill="url(#shadowGrad)" pointer-events="none" />

		<!-- Face Features Group -->
		<g class="transition-all duration-300">
			<!-- Eyes -->
			{#if state === 'happy'}
				<!-- Happy curved closed eyes (^-^) -->
				<path
					d="M 28 48 Q 35 40 42 48"
					stroke="#1e293b"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 58 48 Q 65 40 72 48"
					stroke="#1e293b"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'sleepy' || state === 'idle'}
				<!-- Peaceful closed curved down eyes (u_u) -->
				<path
					d="M 28 46 Q 35 52 42 46"
					stroke="#1e293b"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 58 46 Q 65 52 72 46"
					stroke="#1e293b"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'listening'}
				<!-- Receptive interested eyes (wide o_o) -->
				<circle cx="35" cy="46" r="3" fill="#1e293b" />
				<circle cx="65" cy="46" r="3" fill="#1e293b" />
				<!-- Eyebrows raised slightly -->
				<path
					d="M 28 39 Q 35 34 42 39"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 58 39 Q 65 34 72 39"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'thinking'}
				<!-- Eyes looking sideways/upward -->
				<g class="animate-[pulse_1s_infinite]">
					<ellipse cx="36" cy="44" rx="2.5" ry="3" fill="#1e293b" />
					<ellipse cx="64" cy="44" rx="2.5" ry="3" fill="#1e293b" />
				</g>
				<path
					d="M 29 38 Q 36 36 43 39"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 57 39 Q 64 36 71 38"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'concerned'}
				<!-- Worried / concerned eyes and tilted brows -->
				<circle cx="35" cy="47" r="3" fill="#1e293b" />
				<circle cx="65" cy="47" r="3" fill="#1e293b" />
				<path
					d="M 28 42 Q 35 44 42 40"
					stroke="#1e293b"
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 58 40 Q 65 44 72 42"
					stroke="#1e293b"
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'speaking'}
				<!-- Open animated eyes -->
				<circle cx="35" cy="46" r="3.5" fill="#1e293b" />
				<circle cx="65" cy="46" r="3.5" fill="#1e293b" />
				<path
					d="M 28 38 Q 35 36 42 38"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d="M 58 38 Q 65 36 72 38"
					stroke="#1e293b"
					stroke-width="1.5"
					stroke-linecap="round"
					fill="none"
				/>
			{/if}

			<!-- Mouth -->
			{#if state === 'happy'}
				<!-- Smiling mouth -->
				<path
					d="M 40 58 Q 50 68 60 58"
					stroke="#1e293b"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'concerned'}
				<!-- Soft sad/frown or flat line mouth -->
				<path
					d="M 42 60 Q 50 56 58 60"
					stroke="#1e293b"
					stroke-width="2.5"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'sleepy'}
				<!-- Tiny O mouth (breathing) -->
				<circle cx="50" cy="58" r="2" fill="#1e293b" />
			{:else if state === 'thinking'}
				<!-- Flat wavy or side smirk mouth -->
				<path
					d="M 44 59 Q 50 57 56 59"
					stroke="#1e293b"
					stroke-width="2.5"
					stroke-linecap="round"
					fill="none"
				/>
			{:else if state === 'speaking'}
				<!-- Pulsing open mouth -->
				<ellipse
					cx="50"
					cy="60"
					rx="4"
					ry="5"
					fill="#1e293b"
					class="animate-[bounce_0.2s_infinite_alternate]"
				/>
			{:else if state === 'listening'}
				<!-- Small soft smile -->
				<path
					d="M 43 57 Q 50 62 57 57"
					stroke="#1e293b"
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
				/>
			{:else}
				<!-- Idle: peaceful smirk or soft line -->
				<path
					d="M 44 57 Q 50 61 56 57"
					stroke="#1e293b"
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
				/>
			{/if}

			<!-- Cute Blushing Cheeks -->
			{#if state === 'happy' || state === 'speaking' || state === 'idle'}
				<ellipse cx="25" cy="53" rx="4" ry="2.5" fill="#f87171" opacity="0.35" />
				<ellipse cx="75" cy="53" rx="4" ry="2.5" fill="#f87171" opacity="0.35" />
			{:else if state === 'concerned'}
				<ellipse cx="25" cy="53" rx="3.5" ry="2" fill="#60a5fa" opacity="0.25" />
				<ellipse cx="75" cy="53" rx="3.5" ry="2" fill="#60a5fa" opacity="0.25" />
			{/if}
		</g>
	</svg>

	<!-- Sleepy Floating Zzz's -->
	{#if state === 'sleepy'}
		<div class="absolute right-0 top-0 text-pale-silver select-none pointer-events-none">
			<span class="absolute z-bubble-1 text-lg font-bold opacity-0">Z</span>
			<span
				class="absolute z-bubble-2 text-md font-bold opacity-0"
				style="margin-top:-10px; margin-left: 10px;">z</span
			>
			<span
				class="absolute z-bubble-3 text-sm font-bold opacity-0"
				style="margin-top:-20px; margin-left: 20px;">z</span
			>
		</div>
	{/if}
</div>

<style>
	/* Floating animations for the Zzz's */
	@keyframes float-z {
		0% {
			transform: translate(0, 20px) scale(0.6);
			opacity: 0;
		}
		50% {
			opacity: 0.8;
		}
		100% {
			transform: translate(25px, -30px) scale(1.2);
			opacity: 0;
		}
	}

	.z-bubble-1 {
		animation: float-z 4s infinite linear;
	}
	.z-bubble-2 {
		animation: float-z 4s infinite linear 1.3s;
	}
	.z-bubble-3 {
		animation: float-z 4s infinite linear 2.6s;
	}
</style>
