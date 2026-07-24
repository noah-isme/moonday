<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AvatarMoon from '$lib/components/AvatarMoon.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { page } from '$app/state';
	import { uiStore } from '$lib/stores/ui.svelte';
	import { resolveRoute } from '$app/paths';
	import {
		Bookmark,
		CircleAlert,
		CircleCheck,
		Home,
		MessageCircle,
		NotebookTabs,
		Settings,
		X
	} from 'lucide-svelte';

	let { children } = $props();

	// Navigation items
	const navItems = [
		{
			href: '/',
			label: 'Home',
			Icon: Home
		},
		{
			href: '/chat',
			label: 'Reflections',
			Icon: MessageCircle
		},
		{
			href: '/journal',
			label: 'Journal',
			Icon: NotebookTabs
		},
		{
			href: '/memories',
			label: 'Memories',
			Icon: Bookmark
		},
		{
			href: '/settings',
			label: 'Settings',
			Icon: Settings
		}
	] as const;

	// Extract active pathname helper
	let currentPath = $derived(page.url.pathname);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MOONDAY - AI Emotional Companion</title>
</svelte:head>

<div
	class="app-shell relative flex h-screen flex-col overflow-hidden bg-deep-navy text-soft-white antialiased md:flex-row"
>
	<!-- Left Sidebar (Desktop) -->
	<aside
		class="relative z-10 hidden w-[220px] flex-shrink-0 flex-col border-r border-cyan-glow/10 bg-[#081f1e]/82 p-5 backdrop-blur-xl select-none md:flex"
	>
		<!-- App Brand Header -->
		<div class="mb-6 flex items-center gap-2">
			<span class="font-display text-xl font-extrabold tracking-[0.08em] text-soft-white"
				>MOONDAY</span
			>
			<span
				class="rounded-full border border-cyan-glow/20 bg-cyan-glow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-glow"
				>online</span
			>
		</div>

		<!-- Global Avatar Space -->
		<div
			class="dark-section my-4 flex flex-col items-center justify-center rounded-[2rem] px-3 py-4"
		>
			<div class="w-28 h-28 flex items-center justify-center">
				<AvatarMoon state={uiStore.moonState} />
			</div>
			<div class="mt-4 text-center">
				<span class="eyebrow block">Companion</span>
				<span class="text-sm font-bold text-soft-white">{characterStore.activeCharacter.name}</span>
				<span
					class="mt-1 flex items-center justify-center gap-1.5 text-xs capitalize text-cyan-glow"
				>
					<span
						class="h-1.5 w-1.5 rounded-full bg-cyan-glow shadow-[0_0_10px_var(--color-cyan-glow)]"
					></span>
					{uiStore.moonState}
				</span>
			</div>
		</div>

		<!-- Navigation Menu -->
		<nav class="flex-1 space-y-1.5 mt-3">
			{#each navItems as item (item.href)}
				{@const isActive =
					currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
				<a
					href={resolveRoute(item.href)}
					aria-current={isActive ? 'page' : undefined}
					class="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 {isActive
						? 'border border-cyan-glow/20 bg-cyan-glow/12 text-cyan-glow shadow-[0_0_24px_rgba(103,230,210,0.08)]'
						: 'border border-transparent text-pale-silver hover:bg-white/5 hover:text-soft-white'}"
				>
					<item.Icon
						size={16}
						class="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
					/>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Bottom Footer / Info -->
		<div class="mt-auto border-t border-cyan-glow/10 pt-4">
			<p class="text-xs leading-relaxed text-slate-gray">
				Private by design<br />
				<span class="text-pale-silver">Your orbit, your pace.</span>
			</p>
		</div>
	</aside>

	<!-- Mobile Header Bar -->
	<header
		class="z-40 flex items-center justify-between border-b border-cyan-glow/10 bg-[#081f1e]/90 px-5 py-4 backdrop-blur-xl select-none md:hidden"
	>
		<div class="flex items-center gap-2">
			<span class="font-display text-lg font-extrabold tracking-[0.08em] text-soft-white"
				>MOONDAY</span
			>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-xs font-semibold text-slate-gray capitalize"
				>{characterStore.activeCharacter.name}</span
			>
			<div class="w-10 h-10">
				<AvatarMoon state={uiStore.moonState} />
			</div>
		</div>
	</header>

	<!-- Main App Content Area -->
	<main
		class="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
	>
		<div
			class="mx-auto flex min-h-0 w-full flex-1 flex-col p-4 sm:p-6 {currentPath.startsWith('/chat')
				? 'max-w-[1800px] md:p-5'
				: 'max-w-5xl md:p-8'}"
		>
			{@render children()}
		</div>
	</main>

	{#if uiStore.notice}
		<div
			role="status"
			class="fixed top-4 right-4 z-50 max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-sm font-medium {uiStore
				.notice.tone === 'error'
				? 'bg-soft-red/15 border-soft-red/30 text-soft-white'
				: uiStore.notice.tone === 'info'
					? 'bg-cyan-glow/15 border-cyan-glow/30 text-soft-white'
					: 'bg-calm-green/15 border-calm-green/30 text-soft-white'}"
		>
			{#if uiStore.notice.tone === 'error'}
				<CircleAlert size={18} aria-hidden="true" />
			{:else}
				<CircleCheck size={18} aria-hidden="true" />
			{/if}
			<span>{uiStore.notice.message}</span>
			<button
				type="button"
				onclick={() => uiStore.clearNotice()}
				aria-label="Dismiss notification"
				class="ml-1 cursor-pointer text-slate-gray hover:text-soft-white"
			>
				<X size={16} aria-hidden="true" />
			</button>
		</div>
	{/if}

	<!-- Mobile Bottom Navigation Bar -->
	<nav
		class="fixed right-0 bottom-0 left-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-cyan-glow/10 bg-[#081f1e]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl select-none md:hidden"
	>
		{#each navItems as item (item.href)}
			{@const isActive =
				currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
			<a
				href={resolveRoute(item.href)}
				aria-current={isActive ? 'page' : undefined}
				class="flex h-12 w-14 flex-col items-center justify-center rounded-xl text-xs transition-all duration-300"
				class:text-cyan-glow={isActive}
				class:font-bold={isActive}
				class:text-slate-gray={!isActive}
			>
				<item.Icon size={20} strokeWidth={2} class="mb-0.5" aria-hidden="true" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
