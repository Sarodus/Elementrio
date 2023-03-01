<script lang="ts">
	import { onMount } from 'svelte';
	import { SHOOT_BROADCAST_RADIO } from './constants';
	import { players, shoots } from './Game';
	import type { Player, Shoot } from './types';

	const SHOOT_TIMEOUT_MS = 2000;
	const SHOOT_COLLISION_INTERVAL_MS = 10;
	const SHOOT_VECTOR_SPEED = 500;

	export let shoot: Shoot;
	export let playerX = 0;
	export let playerY = 0;

	onMount(() => {
		const possiblePlayers = getPossiblePlayers($players);
		const timeout = setTimeout(removeShoot, SHOOT_TIMEOUT_MS);
		const interval = setInterval(
			() => checkCollision(possiblePlayers),
			SHOOT_COLLISION_INTERVAL_MS
		);
		return () => {
			clearTimeout(timeout);
			clearInterval(interval);
		};
	});

	function getPossiblePlayers(players: Map<string, Player>) {
		// TODO: optimization with SHOOT_BROADCAST_RADIO
		//
		console.log(SHOOT_BROADCAST_RADIO, players);
		return players;
	}

	function removeShoot() {
		shoots.update((shoots) => shoots.filter((s) => s.id !== shoot.id));
	}

	function checkCollision(possiblePlayers: Map<string, Player>) {
		// console.log('CHECK COLLISION', possiblePlayers);
	}
</script>

<div
	class="absolute shoot-move w-2 h-2 bg-purple-500"
	style="
--shoot-duration: {SHOOT_TIMEOUT_MS}ms;
--shoot-from-x: {shoot.from.x + playerX}px;
--shoot-from-y: {shoot.from.y + playerY}px;
--shoot-to-x: {shoot.to.x * SHOOT_VECTOR_SPEED}px;
--shoot-to-y: {shoot.to.y * SHOOT_VECTOR_SPEED}px;"
/>

<style>
	.shoot-move {
		translate: var(--shoot-from-x) var(--shoot-from-y);
		animation: pulse var(--shoot-duration);
		filter: drop-shadow(0px 0px 10px rgba(255, 0, 0, 0.7));
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			filter: drop-shadow(0px 0px 10px rgba(255, 0, 0, 0.7));
		}
		100% {
			transform: scale(0.95);
			transform: translate(var(--shoot-to-x), var(--shoot-to-y));
			filter: drop-shadow(0 0 0 transparent);
		}
	}
</style>
