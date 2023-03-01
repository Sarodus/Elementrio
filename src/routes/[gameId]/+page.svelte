<script lang="ts">
	import { page } from '$app/stores';
	import Game, { isHost, ready, players, shoots } from '$lib/Game';
	import Pad from '$lib/Pad.svelte';
	import PadShoot from '$lib/PadShoot.svelte';
	import Shot from '$lib/Shot.svelte';
	import { onMount, tick } from 'svelte';
	import { tweened } from 'svelte/motion';

	const TICK_MS = 50;
	const SPEED_RATIO = 10;
	const game = new Game();

	const xSpeed = tweened(0, { duration: 100 });
	const ySpeed = tweened(0, { duration: 100 });

	const x = tweened(0);
	const y = tweened(0);

	let gameEl: HTMLDivElement;
	let playerEl: HTMLDivElement;
	let screenX: number;
	let screenY: number;
	let playing = false;
	let debug = true;
	let isTouchDevice = false;
	let playerBounds: DOMRect;
	let tickInterval: ReturnType<typeof setInterval>;
	let shootInterval = 500;
	let aimX = 0;
	let aimY = 0;
	let mouseShootInterval: ReturnType<typeof setInterval>;

	$: id = $ready && game.id;

	onMount(() => {
		isTouchDevice =
			'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

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
		tickInterval = setInterval(gameTick, TICK_MS);
	}

	function gameTick() {
		if (!$ready) return;

		x.update((v) => v + $xSpeed * SPEED_RATIO);
		y.update((v) => v + $ySpeed * SPEED_RATIO);
		game.broadcastPosition($x, $y);
	}

	function tooggleFullScreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			gameEl.requestFullscreen();
		}
	}

	async function play() {
		if (isTouchDevice) {
			// gameEl.requestFullscreen();
		}
		playing = true;
		await tick();
		await init();
	}

	function handleResize() {
		playerBounds = playerEl.getBoundingClientRect();
		screenX = window.innerWidth;
		screenY = window.innerHeight;
	}

	// function handleMouseMove(event: MouseEvent) {
	// 	console.log('MOUSEMOVE');
	// 	if (!playing) return;
	// 	handleMove(event.clientX, event.clientY);
	// }

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

	function mouseShoot() {
		if (isTouchDevice || !playerBounds) return;
		const shootX = aimX - (screenX - playerBounds.x - playerBounds.width / 2);
		const shootY = aimY - (screenY - playerBounds.y - playerBounds.height / 2);
		shoot(shootX, shootY);
	}

	function startMouseShoot(e: MouseEvent) {
		window.removeEventListener('mousemove', updateAimDirection);
		window.removeEventListener('mouseup', stopMouseShoop);
		window.addEventListener('mousemove', updateAimDirection);
		window.addEventListener('mouseup', stopMouseShoop);
		aimX = e.clientX;
		aimY = e.clientY;
		mouseShoot();
		clearInterval(mouseShootInterval);
		mouseShootInterval = setInterval(mouseShoot, shootInterval);
	}

	function updateAimDirection(e: MouseEvent) {
		aimX = e.clientX;
		aimY = e.clientY;
	}

	function stopMouseShoop(e: MouseEvent) {
		window.removeEventListener('mousemove', updateAimDirection);
		window.removeEventListener('mouseup', stopMouseShoop);
		clearInterval(mouseShootInterval);
	}

	async function shoot(shootX: number, shootY: number) {
		// TODO, prevent shooting clicking fast, throttle
		if (!shootX && !shootY) return;
		// Normalize vector
		const l = Math.sqrt(shootX ** 2 + shootY ** 2);
		const normalizedX = shootX / l;
		const normalizedY = shootY / l;

		game.createShoot(game.id, $x, $y, normalizedX, normalizedY);
	}

	function onKeyDown(e: KeyboardEvent) {
		switch (e.key) {
			case 'd':
			case 'ArrowRight':
				$xSpeed = 1;
				break;
			case 'a':
			case 'ArrowLeft':
				$xSpeed = -1;
				break;
			case 'w':
			case 'ArrowUp':
				$ySpeed = -1;
				break;
			case 's':
			case 'ArrowDown':
				$ySpeed = 1;
				break;
		}
	}
	function onKeyUp(e: KeyboardEvent) {
		switch (e.key) {
			case 'd':
			case 'ArrowRight':
			case 'a':
			case 'ArrowLeft':
				$xSpeed = 0;
				break;
			case 'w':
			case 'ArrowUp':
			case 's':
			case 'ArrowDown':
				$ySpeed = 0;
				break;
		}
		console.log('onKeyUp', e.key);
	}
</script>

<svelte:window
	on:resize={handleResize}
	on:keydown={onKeyDown}
	on:keypress={onKeyDown}
	on:keyup={onKeyUp}
/>
<svelte:head>
	<title>{$isHost ? 'Server' : 'Client'}</title>
</svelte:head>

<div
	bind:this={gameEl}
	class="relative flex items-center justify-center w-full h-screen overflow-hidden"
	on:mousedown={startMouseShoot}
>
	{#if debug}
		<div class="absolute inset-0">
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
			<p>Aim: {aimX} - {aimY}</p>
		</div>
	{/if}

	{#if isTouchDevice}
		<button
			on:click={tooggleFullScreen}
			class="absolute p-3 border rounded top-4 right-4 border-slate-600 hover:bg-slate-600"
		>
			<svg class="fill-white" height="14px" version="1.1" viewBox="0 0 14 14" width="14px">
				<path
					d="M2,9 L0,9 L0,14 L5,14 L5,12 L2,12 L2,9 L2,9 Z M0,5 L2,5 L2,2 L5,2 L5,0 L0,0 L0,5 L0,5 Z M12,12 L9,12 L9,14 L14,14 L14,9 L12,9 L12,12 L12,12 Z M9,0 L9,2 L12,2 L12,5 L14,5 L14,0 L9,0 L9,0 Z"
				/>
			</svg>
		</button>
		<div class="absolute bottom-4 left-4">
			<Pad bind:x={$xSpeed} bind:y={$ySpeed} />
		</div>
		<div class="absolute bottom-4 right-4">
			<PadShoot {shootInterval} on:shoot={(e) => shoot(e.detail.x, e.detail.y)} />
		</div>
	{/if}

	{#if !playing}
		<button
			on:click={play}
			class="absolute px-5 py-3 m-auto transition-all border rounded border-slate-600 hover:bg-slate-600 hover:translate-y-1"
		>
			PLAY
		</button>
	{:else}
		<!-- Shoots -->
		{#each $shoots as shoot (shoot.id)}
			{@const ownShoot = shoot.playerId === game.id}
			<Shot {shoot} playerX={ownShoot ? 0 : $x} playerY={ownShoot ? 0 : $y} />
		{/each}

		<!-- Player -->
		<div
			bind:this={playerEl}
			class="z-10 w-10 h-10 bg-white border-4 rounded-full border-cyan-300"
		/>

		{#if $ready}
			{#each Array.from($players.entries()) as [id, player]}
				{#if id !== game.id}
					<div
						style="transform: translate({player.x - $x}px, {player.y - $y}px);"
						class="absolute w-10 h-10 transition-transform duration-100 bg-red-100 border-4 border-red-500 rounded-full"
					/>
				{/if}
			{/each}
		{/if}
	{/if}
</div>
