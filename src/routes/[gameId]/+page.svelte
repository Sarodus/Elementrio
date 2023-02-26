<script lang="ts">
	import { page } from '$app/stores';
	import Game from '$lib/Game';
	import { onMount } from 'svelte';
	import { tweened } from 'svelte/motion';

	const TICK_MS = 50;
	const SPEED_RATIO = 10;
	const game = new Game();
	const isHost = game.isHost;
	const ready = game.ready;
	const players = game.players;

	const xSpeed = tweened(0, { duration: 100 });
	const ySpeed = tweened(0, { duration: 100 });

	const x = tweened(0);
	const y = tweened(0);

	let gameEl: HTMLDivElement;
	let playerEl: HTMLDivElement;
	let screenX: number;
	let screenY: number;
	let playing = false;
	let playerBounds: DOMRect;
	let tickInterval: ReturnType<typeof setInterval>;

	$: id = $ready && game.id;

	onMount(() => {
		return () => {
			clearInterval(tickInterval);
			game.destroy();
		};
	});

	async function init() {
		try {
			await game.tryBeHost($page.params.gameId);
		} catch (error) {
			await game.joinGame($page.params.gameId);
		}
		handleResize();
		tickInterval = setInterval(tick, TICK_MS);
	}

	function tick() {
		if (!$ready) return;

		x.update((v) => v + $xSpeed * SPEED_RATIO);
		y.update((v) => v + $ySpeed * SPEED_RATIO);
		game.broadcastPosition($x, $y);
	}

	async function play() {
		gameEl.requestFullscreen();
		playing = true;
		await tick();
		await init();
	}

	function handleResize() {
		playerBounds = playerEl.getBoundingClientRect();
		screenX = window.innerWidth;
		screenY = window.innerHeight;
	}

	function handleMouseMove(event: MouseEvent) {
		handleMove(event.clientX, event.clientY);
	}

	function handleTouchMove(event: TouchEvent) {
		handleMove(event.touches[0].clientX, event.touches[0].clientY);
	}

	function handleMove(clientX: number, clientY: number) {
		const xMaxForce = (screenX - playerBounds.width) / 4;
		const xForce = screenX / 2 - clientX;
		const xForceRatio = -(xForce / xMaxForce);
		xSpeed.set(Math.min(1, Math.max(-1, xForceRatio)));

		const yMaxForce = (screenY - playerBounds.width) / 4;
		const yForce = Math.min(yMaxForce, Math.max(screenY / 2 - clientY));
		const yForceRatio = -(yForce / yMaxForce);
		ySpeed.set(Math.min(1, Math.max(-1, yForceRatio)));
	}
</script>

<svelte:window on:resize={handleResize} />
<svelte:head>
	<title>{$isHost ? 'Server' : 'Client'}</title>
</svelte:head>

<div class="absolute">
	{#each Array.from($players.entries()) as [id, player]}
		<p>{id} - {player.name} - {player.x} - {player.y}</p>
	{/each}
	<hr />
	{id}
	<hr />
	<p>xSpeed: {$xSpeed}</p>
	<p>ySpeed: {$ySpeed}</p>
	<p>X: {$x}</p>
	<p>Y: {$y}</p>
</div>

<div
	bind:this={gameEl}
	class="bg-slate-800 h-screen flex items-center justify-center relative"
	on:mousemove={handleMouseMove}
	on:touchmove={handleTouchMove}
>
	{#if !playing}
		<button on:click={play} class="absolute inset-1/2">PLAY</button>
	{:else}
		<div
			bind:this={playerEl}
			class="rounded-full bg-white w-10 h-10 border-4 border-cyan-300 z-10"
		/>
		{#if $ready}
			{#each Array.from($players.entries()) as [id, player]}
				{#if id !== game.id}
					<div
						style="transform: translate({player.x - $x}px, {player.y - $y}px);"
						class="absolute transition-transform duration-100 rounded-full bg-red-100 w-10 h-10 border-4 border-red-500"
					/>
				{/if}
			{/each}
		{/if}
	{/if}
</div>
