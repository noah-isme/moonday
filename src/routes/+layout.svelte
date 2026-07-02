<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AvatarMoon from '$lib/components/AvatarMoon.svelte';
	import { characterStore } from '$lib/stores/character.svelte';
	import { page } from '$app/state';
	import { uiStore } from '$lib/stores/ui.svelte';

	let { children } = $props();

	// Navigation items
	const navItems = [
		{
			href: '/',
			label: 'Home',
			icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
		},
		{
			href: '/chat',
			label: 'Reflections',
			icon: 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z'
		},
		{
			href: '/journal',
			label: 'Journal',
			icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
		},
		{
			href: '/memories',
			label: 'Memories',
			icon: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z'
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.214-1.28Z'
		}
	];

	// Extract active pathname helper
	let currentPath = $derived(page.url.pathname);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MOONDAY - AI Emotional Companion</title>
</svelte:head>

<div class="flex flex-col md:flex-row min-h-screen bg-deep-navy text-soft-white antialiased">
	<!-- Left Sidebar (Desktop) -->
	<aside
		class="hidden md:flex flex-col w-72 bg-soft-dark-blue border-r border-slate-gray/10 p-6 flex-shrink-0 select-none"
	>
		<!-- App Brand Header -->
		<div class="flex items-center gap-2 mb-6">
			<span class="text-xl font-black text-moon-yellow tracking-wider font-mono">MOONDAY</span>
			<span
				class="text-[9px] bg-violet-glow/10 text-violet-glow px-1.5 py-0.5 rounded font-mono border border-violet-glow/20 uppercase font-bold"
				>MVP</span
			>
		</div>

		<!-- Global Avatar Space -->
		<div
			class="flex flex-col items-center justify-center my-6 py-4 bg-deep-navy/30 rounded-3xl border border-slate-gray/5"
		>
			<div class="w-32 h-32 flex items-center justify-center">
				<AvatarMoon state={uiStore.moonState} />
			</div>
			<div class="mt-4 text-center">
				<span class="text-xs font-semibold text-slate-gray uppercase tracking-wider block"
					>Companion</span
				>
				<span class="text-sm font-bold text-soft-white">{characterStore.activeCharacter.name}</span>
				<span class="text-[10px] text-violet-glow block mt-0.5 capitalize italic">
					({uiStore.moonState})
				</span>
			</div>
		</div>

		<!-- Navigation Menu -->
		<nav class="flex-1 space-y-1.5 mt-4">
			{#each navItems as item}
				{@const isActive =
					currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
				<a
					href={item.href}
					class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group {isActive
						? 'bg-violet-glow text-deep-navy font-bold'
						: 'text-pale-silver hover:bg-slate-gray/5 hover:text-soft-white'}"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="w-5 h-5 transition-transform duration-300 group-hover:scale-105"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Bottom Brand note -->
		<div
			class="pt-4 border-t border-slate-gray/10 text-[10px] text-slate-gray text-center font-mono"
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
	<main class="flex-1 flex flex-col min-h-0 relative pb-16 md:pb-0 overflow-y-auto">
		<div class="max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 flex-1 flex flex-col">
			{@render children()}
		</div>
	</main>

	<!-- Mobile Bottom Navigation Bar -->
	<nav
		class="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-soft-dark-blue/95 backdrop-blur-md border-t border-slate-gray/10 z-40 justify-around items-center px-2 select-none"
	>
		{#each navItems as item}
			{@const isActive =
				currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
			<a
				href={item.href}
				class="flex flex-col items-center justify-center w-14 h-12 rounded-xl text-[10px] transition-all duration-300"
				class:text-violet-glow={isActive}
				class:font-bold={isActive}
				class:text-slate-gray={!isActive}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-5 h-5 mb-0.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
				</svg>
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
