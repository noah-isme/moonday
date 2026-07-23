<script lang="ts">
	import { moodStore, MOODS } from '$lib/stores/mood.svelte';
	import { onMount } from 'svelte';
	import { Lightbulb } from 'lucide-svelte';

	let trendsData = $state<any[]>([]);
	let reflections = $state<any[]>([]);
	let weekly = $state<any>(null);
	let weeklyDraft = $state<any>(null);
	let weekStart = $state('');
	let weeklyLoading = $state(false);
	let correction = $state('');
	let showCorrection = $state(false);

	onMount(async () => {
		try {
			const [trendsResponse, reflectionsResponse, weeklyResponse] = await Promise.all([
				fetch('/api/journal/trends'),
				fetch('/api/reflections'),
				fetch('/api/journal/weekly')
			]);
			if (trendsResponse.ok) trendsData = await trendsResponse.json();
			if (reflectionsResponse.ok) reflections = await reflectionsResponse.json();
			if (weeklyResponse.ok) {
				const data = await weeklyResponse.json();
				weekly = data.reflection;
				weeklyDraft = data.draft;
				weekStart = data.weekStart;
			}
		} catch (e) {
			console.error('Failed to fetch journal trends:', e);
		}
	});

	async function generateWeeklyReflection() {
		weeklyLoading = true;
		try {
			const response = await fetch('/api/journal/weekly', { method: 'POST' });
			if (!response.ok) throw new Error('Unable to create weekly reflection.');
			weekly = (await response.json()).reflection;
			showCorrection = false;
			correction = '';
		} catch (error) {
			console.error(error);
		} finally {
			weeklyLoading = false;
		}
	}

	async function giveWeeklyFeedback(action: 'dismiss' | 'correct') {
		if (!weekly || (action === 'correct' && !correction.trim())) return;
		const response = await fetch('/api/journal/weekly', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: weekly.id, action, correction: correction.trim() || undefined })
		});
		if (response.ok) weekly = (await response.json()).reflection;
	}


	function formatDate(value: string) {
		return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// Prepare data for the SVG mood trend chart
	let chartLogs = $derived.by(() => {
		// Use trendsData if loaded, otherwise fallback to moodStore.logs
		const rawLogs = trendsData.length > 0 ? trendsData : moodStore.logs;

		// Sort chronologically using Date timestamp comparison (O(n log n))
		const sorted = [...rawLogs].sort((a, b) => {
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
		});

		// Take the last 7 check-ins
		return sorted.slice(-7);
	});

	// SVG Chart sizing parameters
	const width = 500;
	const height = 150;
	const padding = 25;

	// Scale points helper
	let chartPoints = $derived.by(() => {
		if (chartLogs.length === 0) return [];

		const xStep = (width - padding * 2) / Math.max(1, chartLogs.length - 1);

		return chartLogs.map((log, index) => {
			const x = padding + index * xStep;
			// Map moodScore (-5 to 5) to Y height: -5 is bottom (height - padding), 5 is top (padding)
			const normalizedScore = (log.moodScore + 5) / 10; // 0 to 1
			const y = height - padding - normalizedScore * (height - padding * 2);

			// Format X-axis date consistently, e.g. "DD MMM"
			const dateObj = new Date(log.createdAt);
			const day = String(dateObj.getDate()).padStart(2, '0');
			const months = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec'
			];
			const month = months[dateObj.getMonth()];
			const formattedDate = `${day} ${month}`;

			return {
				x,
				y,
				score: log.moodScore,
				label: log.moodLabel,
				date: formattedDate
			};
		});
	});

	// SVG Path command generator
	let linePath = $derived.by(() => {
		if (chartPoints.length < 2) return '';
		return chartPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
	});
</script>

<div class="space-y-8 select-none">
	<!-- Page Header -->
	<div class="space-y-2 select-none">
		<h1 class="text-2xl font-extrabold text-soft-white tracking-tight">
			Journal & Reflection Trends
		</h1>
		<p class="text-xs text-slate-gray">
			Analyze your emotional patterns and read MOONDAY's structured daily focus points.
		</p>
	</div>

	<div class="bg-soft-dark-blue border border-violet-glow/20 rounded-3xl p-5 md:p-6 shadow-xl">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="text-sm font-bold text-soft-white">This week, tentatively</h2>
				<p class="mt-1 text-xs text-slate-gray">Built from your logged moods, daily reflections, and memories you approved. This is a reflection, not a diagnosis.</p>
			</div>
			<button type="button" onclick={generateWeeklyReflection} disabled={weeklyLoading} class="rounded-xl bg-violet-glow px-3 py-2 text-xs font-semibold text-deep-navy disabled:opacity-50">{weeklyLoading ? 'Generating…' : weekly ? 'Refresh reflection' : 'Generate weekly reflection'}</button>
		</div>
		{#if weekly && weekly.status !== 'dismissed'}
			<div class="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
				<div class="rounded-2xl bg-deep-navy/45 p-3 sm:col-span-2"><p class="font-semibold text-pale-silver">{weekly.summary}</p></div>
				<div class="rounded-2xl border border-slate-gray/10 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-cyan-glow">What may have helped</p><p class="mt-1.5 text-pale-silver">{weekly.whatHelped}</p></div>
				<div class="rounded-2xl border border-slate-gray/10 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-moon-yellow">What may have felt heavy</p><p class="mt-1.5 text-pale-silver">{weekly.whatFeltHeavy}</p></div>
				<div class="rounded-2xl border border-violet-glow/20 bg-violet-glow/5 p-3 sm:col-span-2"><p class="text-[10px] font-bold uppercase tracking-wide text-violet-glow">Suggested focus</p><p class="mt-1.5 text-pale-silver">{weekly.suggestedFocus}</p></div>
			</div>
			{#if weekly.correction}<p class="mt-3 text-xs text-cyan-glow">Your correction: {weekly.correction}</p>{/if}
			<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
				<button type="button" onclick={() => (showCorrection = !showCorrection)} class="rounded-lg border border-slate-gray/15 px-2.5 py-1.5 text-slate-gray hover:text-pale-silver">Correct this</button>
				<button type="button" onclick={() => giveWeeklyFeedback('dismiss')} class="rounded-lg px-2.5 py-1.5 text-slate-gray hover:text-soft-red">Dismiss insight</button>
				<span class="ml-auto text-[11px] text-slate-gray">Week of {formatDate(weekStart)}</span>
			</div>
			{#if showCorrection}
				<div class="mt-3 flex gap-2"><input bind:value={correction} maxlength="1000" placeholder="What should MOONDAY understand differently?" class="min-w-0 flex-1 rounded-xl border border-slate-gray/15 bg-deep-navy px-3 py-2 text-xs text-soft-white outline-none" /><button type="button" onclick={() => giveWeeklyFeedback('correct')} class="rounded-xl bg-cyan-glow px-3 py-2 text-xs font-semibold text-deep-navy">Save correction</button></div>
			{/if}
		{:else if weekly?.status === 'dismissed'}
			<p class="mt-4 text-xs text-slate-gray">You dismissed this week’s reflection. You can generate a new one whenever it would be useful.</p>
		{:else if weeklyDraft}
			<p class="mt-4 text-xs text-slate-gray">{weeklyDraft.summary}</p>
		{/if}
	</div>

	<!-- Mood Trend Visual Chart Section -->
	<div
		class="bg-soft-dark-blue border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl"
	>
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-sm font-bold text-soft-white">Mood Trend Line</h2>
				<p class="text-[10px] text-slate-gray">
					Last {chartLogs.length} logged check-ins (-5 to 5 scale)
				</p>
			</div>

			<div class="flex gap-4 text-[10px] text-slate-gray font-mono">
				<div class="flex items-center gap-1">
					<span class="w-2 h-2 rounded-full bg-cyan-glow"></span>
					<span>Positive</span>
				</div>
				<div class="flex items-center gap-1">
					<span class="w-2 h-2 rounded-full bg-soft-red"></span>
					<span>Negative</span>
				</div>
			</div>
		</div>

		<!-- SVG Line Graph -->
		<div
			class="relative w-full overflow-hidden bg-deep-navy/30 rounded-2xl border border-slate-gray/5 p-2"
		>
			{#if chartPoints.length > 0}
				<svg viewBox="0 0 {width} {height}" class="w-full h-auto">
					<!-- Helper Grid Lines -->
					<line
						x1={padding}
						y1={height / 2}
						x2={width - padding}
						y2={height / 2}
						stroke="#334155"
						stroke-width="1"
						stroke-dasharray="3,3"
					/>
					<line
						x1={padding}
						y1={padding}
						x2={width - padding}
						y2={padding}
						stroke="#1e293b"
						stroke-width="1"
					/>
					<line
						x1={padding}
						y1={height - padding}
						x2={width - padding}
						y2={height - padding}
						stroke="#1e293b"
						stroke-width="1"
					/>

					<!-- Glow effect definition -->
					<defs>
						<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" result="blur" />
							<feComposite in="SourceGraphic" in2="blur" operator="over" />
						</filter>
					</defs>

					<!-- Connection Path Line -->
					{#if linePath}
						<path
							d={linePath}
							fill="none"
							stroke="url(#lineGradient)"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							filter="url(#glow)"
						/>

						<!-- Gradient for the line -->
						<linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset="0%" stop-color="#22d3ee" />
							<stop offset="50%" stop-color="#a78bfa" />
							<stop offset="100%" stop-color="#f87171" />
						</linearGradient>
					{/if}

					<!-- Point Markers & Text Labels -->
					{#each chartPoints as pt}
						<g class="group/point">
							<!-- Hover expanding circle -->
							<circle
								cx={pt.x}
								cy={pt.y}
								r="8"
								fill="rgba(167, 139, 250, 0.2)"
								class="scale-0 group-hover/point:scale-100 transition-transform duration-200 origin-center"
							/>
							<!-- Inner marker -->
							<circle
								cx={pt.x}
								cy={pt.y}
								r="4"
								fill={pt.score >= 0 ? '#22d3ee' : '#f87171'}
								stroke="#0a0e17"
								stroke-width="1.5"
							/>

							<!-- Value/Emoji Popup on Hover -->
							<text
								x={pt.x}
								y={pt.y - 10}
								text-anchor="middle"
								font-size="8"
								fill="#cbd5e1"
								class="font-bold opacity-0 group-hover/point:opacity-100 transition-opacity duration-200"
							>
								{pt.score > 0 ? '+' : ''}{pt.score}
							</text>

							<!-- Date Label below point -->
							<text
								x={pt.x}
								y={height - 8}
								text-anchor="middle"
								font-size="7"
								fill="#64748b"
								class="font-mono"
							>
								{pt.date}
							</text>
						</g>
					{/each}
				</svg>
			{:else}
				<div class="h-28 flex flex-col items-center justify-center text-center opacity-40">
					<p class="text-xs font-semibold">No mood history available.</p>
					<p class="text-[10px] mt-0.5">
						Submit check-ins on the Home screen to view graph analytics.
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Timeline of reflections -->
	<div class="space-y-4">
		<h2 class="text-sm font-bold text-soft-white uppercase tracking-wider select-none">
			Daily Reflections Timeline
		</h2>

		<div class="space-y-4">
			{#each reflections as reflection}
				<div
					class="bg-soft-dark-blue/70 border border-slate-gray/10 rounded-3xl p-5 md:p-6 space-y-3 relative hover:border-slate-gray/25 transition-colors duration-300"
				>
					<!-- Date Badge -->
					<div class="flex justify-between items-center">
						<span class="text-xs font-bold text-violet-glow font-mono">{formatDate(reflection.date)}</span>
						<span
							class="text-[9px] bg-violet-glow/10 text-violet-glow border border-violet-glow/15 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
						>
							Completed Reflection
						</span>
					</div>

					<!-- Reflection Title / Mood Summary -->
					<h3 class="text-md font-bold text-soft-white">{reflection.moodSummary}</h3>

					<!-- Companion Focus Card -->
					<div
						class="p-4 bg-violet-glow/10 border border-violet-glow/25 rounded-2xl flex gap-3 text-xs shadow-[0_0_24px_rgba(167,139,250,0.08)]"
					>
						<Lightbulb size={18} class="mt-0.5 shrink-0 text-moon-yellow" aria-hidden="true" />
						<div>
							<span
								class="font-bold text-moon-yellow block text-[10px] uppercase tracking-wider mb-1"
								>Suggested Navigator Focus</span
							>
							<p class="text-soft-white leading-relaxed">{reflection.suggestedFocus}</p>
						</div>
					</div>

					<!-- Core text grids -->
					<div
						class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-gray/10"
					>
						<!-- Content -->
						<div class="space-y-1">
							<span class="font-bold text-slate-gray uppercase text-[9px] tracking-wider block"
								>Emotional Summary</span
							>
							<p class="text-pale-silver leading-relaxed">{reflection.emotionalSummary}</p>
						</div>

						<!-- Content -->
						<div class="space-y-1">
							<span class="font-bold text-slate-gray uppercase text-[9px] tracking-wider block"
								>Highlights & Events</span
							>
							<p class="text-pale-silver leading-relaxed">{reflection.importantEvents}</p>
						</div>
					</div>
				</div>
			{:else}
				<div class="rounded-3xl border border-dashed border-slate-gray/15 p-6 text-center text-xs text-slate-gray">No daily reflections yet. Generate one after a mood check-in or a meaningful conversation.</div>
			{/each}
		</div>
	</div>
</div>
