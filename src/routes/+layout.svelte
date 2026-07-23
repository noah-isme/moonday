<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AvatarMoon from '$lib/components/AvatarMoon.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { page } from '$app/state';
	import { uiStore } from '$lib/stores/ui.svelte';
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
	];

	// Extract active pathname helper
	let currentPath = $derived(page.url.pathname);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MOONDAY - AI Emotional Companion</title>
</svelte:head>

<div
	class="flex h-screen flex-col overflow-hidden bg-deep-navy text-soft-white antialiased md:flex-row"
>
	<!-- Left Sidebar (Desktop) -->
	<aside
		class="hidden w-[220px] flex-shrink-0 flex-col border-r border-white/6 bg-soft-dark-blue/70 p-5 select-none md:flex"
	>
		<!-- App Brand Header -->
		<div class="flex items-center gap-2 mb-6">
			<span class="text-xl font-black text-moon-yellow tracking-wider font-mono">MOONDAY</span>
			<span
				class="rounded border border-violet-glow/20 bg-violet-glow/10 px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-violet-glow"
				>MVP</span
			>
		</div>

		<!-- Global Avatar Space -->
		<div
			class="flex flex-col items-center justify-center my-4 py-3 bg-deep-navy/30 rounded-3xl border border-slate-gray/5"
		>
			<div class="w-28 h-28 flex items-center justify-center">
				<AvatarMoon state={uiStore.moonState} />
			</div>
			<div class="mt-4 text-center">
				<span class="text-xs font-semibold text-slate-gray uppercase tracking-wider block"
					>Companion</span
				>
				<span class="text-sm font-bold text-soft-white">{characterStore.activeCharacter.name}</span>
				<span class="mt-0.5 block text-xs capitalize italic text-violet-glow">
					({uiStore.moonState})
				</span>
			</div>
		</div>

		<!-- Navigation Menu -->
		<nav class="flex-1 space-y-1.5 mt-3">
			{#each navItems as item}
				{@const isActive =
					currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
				<a
					href={item.href}
					aria-current={isActive ? 'page' : undefined}
					class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group {isActive
						? 'bg-violet-glow text-deep-navy font-bold'
						: 'text-pale-silver hover:bg-slate-gray/5 hover:text-soft-white'}"
				>
					<item.Icon
						size={20}
						strokeWidth={2}
						class="transition-transform duration-300 group-hover:scale-105"
						aria-hidden="true"
					/>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Bottom Brand note -->
		<div
			class="border-t border-slate-gray/10 pt-4 text-center font-mono text-xs leading-relaxed text-slate-gray"
		>
			<p>Mindful Optimist Onboard Navigator Developed Around You</p>
		</div>
	</aside>

	<!-- Mobile Header Bar -->
	<header
		class="flex md:hidden items-center justify-between px-5 py-4 bg-soft-dark-blue border-b border-slate-gray/10 z-40 select-none"
	>
		<div class="flex items-center gap-2">
			<span class="text-lg font-black text-moon-yellow tracking-wider font-mono">MOONDAY</span>
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
		class="flex-1 flex flex-col min-h-0 relative pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-y-auto"
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
		class="flex md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-soft-dark-blue/95 backdrop-blur-md border-t border-slate-gray/10 z-40 justify-around items-center px-2 select-none"
	>
		{#each navItems as item}
			{@const isActive =
				currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
			<a
				href={item.href}
				aria-current={isActive ? 'page' : undefined}
				class="flex h-12 w-14 flex-col items-center justify-center rounded-xl text-xs transition-all duration-300"
				class:text-violet-glow={isActive}
				class:font-bold={isActive}
				class:text-slate-gray={!isActive}
			>
				<item.Icon size={20} strokeWidth={2} class="mb-0.5" aria-hidden="true" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
