<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	const innerBoxSize = 40;

	const dispatch = createEventDispatcher<{ shoot: { x: number; y: number } }>();

	export let shootInterval = 500;
	export let x = 0;
	export let y = 0;

	let padEl: HTMLButtonElement;
	let identifier: number;
	let bounds: DOMRect;
	let maxOffset = 0;

	let offsetX = 0;
	let offsetY = 0;

	let isShooting = false;
	let shootingInterval: ReturnType<typeof setInterval>;

	$: x = offsetX / maxOffset || 0;
	$: y = offsetY / maxOffset || 0;

	function handleTouchStart(e: TouchEvent) {
		e.stopPropagation();
		const touch = Array.from(e.touches).find(
			(t) => (t.target as HTMLElement).closest('button') === padEl
		);
		if (!touch) return;
		identifier = touch.identifier;
		bounds = padEl.getBoundingClientRect();
		maxOffset = (bounds.width - innerBoxSize) / 2.2;
		handleMove(touch.clientX, touch.clientY);
		isShooting = true;
		clearInterval(shootingInterval);
		shootingInterval = setInterval(() => shoot(), shootInterval);
		tick().then(shoot);
	}

	function handleTouchMove(e: TouchEvent) {
		const touch = Array.from(e.touches).find((t) => t.identifier === identifier);
		if (!touch) return;
		handleMove(touch.clientX, touch.clientY);
	}

	function handleTouchEnd(e: TouchEvent) {
		const touch = Array.from(e.changedTouches).find((t) => t.identifier === identifier);
		if (!touch) return;
		offsetX = 0;
		offsetY = 0;
		isShooting = false;
		clearInterval(shootingInterval);
	}

	function handleMove(clientX: number, clientY: number) {
		offsetX = Math.max(Math.min(clientX - bounds.x - bounds.width / 2, maxOffset), -maxOffset);
		offsetY = Math.max(Math.min(clientY - bounds.y - bounds.height / 2, maxOffset), -maxOffset);
	}

	function shoot() {
		dispatch('shoot', { x, y });
	}
</script>

<button
	bind:this={padEl}
	on:touchstart={handleTouchStart}
	on:touchmove={handleTouchMove}
	on:touchend={handleTouchEnd}
	class="flex items-center justify-center border rounded-full w-44 h-44 border-slate-600"
>
	<div
		style:--shoot-interval="{shootInterval}ms"
		style="translate: {offsetX}px {offsetY}px;"
		class:transition-transform={offsetX === 0 && offsetY === 0}
		class:duration-150={offsetX === 0 && offsetY === 0}
		class:pulse={isShooting}
		class="w-10 h-10 bg-white rounded-full"
	/>
</button>

<style>
	.pulse {
		animation: pulse var(--shoot-interval) infinite;
		filter: drop-shadow(0px 0px 10px transparent);
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			filter: drop-shadow(0 0 0 transparent);
		}
		10% {
			transform: scale(1.2);
			fill: rgb(239 68 68 / var(--tw-bg-opacity));
			filter: drop-shadow(0px 0px 10px rgba(255, 0, 0, 0.7));
		}

		70% {
			transform: scale(1);
			filter: drop-shadow(0px 0px 10px rgba(255, 0, 0, 0.7));
		}

		100% {
			transform: scale(0.95);
			filter: drop-shadow(0 0 0 transparent);
		}
	}
</style>
