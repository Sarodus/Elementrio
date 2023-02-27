<script lang="ts">
	const innerBoxSize = 40;

	let padEl: HTMLButtonElement;
	let identifier: number;
	let bounds: DOMRect;
	let maxOffset = 0;

	let offsetX = 0;
	let offsetY = 0;

	export let x = 0;
	export let y = 0;

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
	}

	function handleMove(clientX: number, clientY: number) {
		offsetX = Math.max(Math.min(clientX - bounds.x - bounds.width / 2, maxOffset), -maxOffset);
		offsetY = Math.max(Math.min(clientY - bounds.y - bounds.height / 2, maxOffset), -maxOffset);
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
		style="transform: translate({offsetX}px, {offsetY}px);"
		class:transition-transform={offsetX === 0 && offsetY === 0}
		class:duration-150={offsetX === 0 && offsetY === 0}
		class="w-10 h-10 bg-white rounded-full"
	/>
</button>
