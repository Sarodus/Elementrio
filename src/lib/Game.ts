import { type DataConnection, Peer } from 'peerjs';
import { get, writable } from 'svelte/store';
import type { Player, Shoot } from './types';
import { v4 as uuidv4 } from 'uuid';
import { SHOOT_BROADCAST_RADIO } from './constants';

enum BroadcastActions {
	SYNC_PLAYERS,
	SYNC_POSITIONS,
	PLAYER_SHOOT
}

interface Action {
	action: BroadcastActions;
	data?: unknown;
}
interface ActionSyncPlayer extends Action {
	action: BroadcastActions.SYNC_PLAYERS;
	data: string[];
}

interface ActionSyncPositions extends Action {
	action: BroadcastActions.SYNC_POSITIONS;
	data: [number, number];
}

interface ActionPlayerShoot extends Action {
	action: BroadcastActions.PLAYER_SHOOT;
	data: Shoot;
}

type Actions = ActionSyncPlayer | ActionSyncPositions | ActionPlayerShoot;

export const isHost = writable(false);
export const ready = writable(false);
export const data = writable('');
export const players = writable<Map<string, Player>>(new Map());
export const shoots = writable<Shoot[]>([]);

export default class Game {
	id: string = '';
	peer?: Peer;
	cons: Map<string, DataConnection> = new Map();

	async tryBeHost(gameId: string) {
		if (this.peer) return;

		const peer = new Peer(gameId);
		try {
			this.id = await new Promise((resolve, reject) => {
				peer.on('open', resolve);
				peer.on('error', reject);
				peer.on('connection', (conn) => {
					conn.on('open', () => {
						this.cons.set(conn.peer, conn);
						players.update((players) => {
							players.set(conn.peer, { name: '', x: 0, y: 0 });
							return players;
						});
						this.broadcastSyncPlayers();
					});
					conn.on('data', (data) => {
						this.handleData(conn.peer, data as Actions);
					});
					conn.on('close', () => {
						this.cons.delete(conn.peer);
						players.update((players) => {
							players.delete(conn.peer);
							return players;
						});
					});
					conn.on('iceStateChanged', (status) => {
						if (status === 'disconnected' || status === 'closed' || status === 'failed') {
							this.cons.delete(conn.peer);
							players.update((players) => {
								players.delete(conn.peer);
								return players;
							});
						}
					});
				});
			});
			players.update((players) => {
				players.set(this.id, { name: '', x: 0, y: 0 });
				return players;
			});
			isHost.set(true);
			ready.set(true);
			this.peer = peer;
		} catch (error) {
			isHost.set(false);
			throw error;
		}
	}

	async joinGame(gameId: string) {
		const peer = new Peer();
		this.peer = peer;
		peer.on('open', () => {
			this.id = peer.id;
			const conn = peer.connect(gameId);
			conn.on('error', console.log);
			conn.on('open', () => {
				this.cons.set(conn.peer, conn);
			});
			conn.on('data', (data) => {
				this.handleData(conn.peer, data as Actions);
			});
			conn.on('close', () => {
				this.handleServerClose();
			});
			conn.on('iceStateChanged', (status) => {
				if (status === 'disconnected' || status === 'closed' || status === 'failed') {
					this.handleServerClose();
				}
			});
			players.update((players) => {
				players.set(this.id, { name: '', x: 0, y: 0 });
				players.set(gameId, { name: '', x: 0, y: 0 });
				return players;
			});
			ready.set(true);
		});
		peer.on('connection', (conn) => {
			conn.on('open', () => {
				this.cons.set(conn.peer, conn);
				players.update((players) => {
					players.set(conn.peer, { name: '', x: 0, y: 0 });
					return players;
				});
			});
			conn.on('data', (data) => {
				this.handleData(conn.peer, data as Actions);
			});
			conn.on('close', () => {
				this.cons.delete(conn.peer);
				players.update((players) => {
					players.delete(conn.peer);
					return players;
				});
			});
			conn.on('iceStateChanged', (status) => {
				if (status === 'disconnected' || status === 'closed' || status === 'failed') {
					this.cons.delete(conn.peer);
					players.update((players) => {
						players.delete(conn.peer);
						return players;
					});
				}
			});
		});
	}

	connectToPeer(peerId: string) {
		if (!this.peer) throw Error('Peer not initialized!');

		const conn = this.peer.connect(peerId);
		conn.on('error', console.log);
		conn.on('open', () => {
			this.cons.set(conn.peer, conn);
			players.update((players) => {
				players.set(conn.peer, { name: '', x: 0, y: 0 });
				return players;
			});
		});
		conn.on('data', (data) => {
			this.handleData(conn.peer, data as Actions);
		});
		conn.on('close', () => {
			console.log('CLOSED!', conn, peerId, conn.peer);
			this.cons.delete(conn.peer);
			players.update((players) => {
				players.delete(conn.peer);
				return players;
			});
		});
		conn.on('iceStateChanged', (status) => {
			if (status === 'disconnected' || status === 'closed' || status === 'failed') {
				players.update((players) => {
					players.delete(conn.peer);
					return players;
				});
				this.cons.delete(conn.peer);
			}
		});
	}

	handleServerClose() {
		console.log('HANDLE SERVE CLOSE!');
	}

	broadcast(action: Action, radio?: number) {
		// TODO: radio broadcast
		this.cons.forEach((conn) => conn.send(action));
	}

	broadcastSyncPlayers() {
		const syncAction: ActionSyncPlayer = {
			action: BroadcastActions.SYNC_PLAYERS,
			data: Array.from(get(players).keys())
		};
		this.broadcast(syncAction);
	}

	syncPlayers(action: ActionSyncPlayer) {
		const newCons = action.data.filter((id) => !this.cons.has(id) && id !== this.id);
		newCons.forEach((peerId) => {
			this.connectToPeer(peerId);
		});
		console.log(this.cons);
	}

	broadcastPosition(x: number, y: number) {
		const syncAction: ActionSyncPositions = {
			action: BroadcastActions.SYNC_POSITIONS,
			data: [x, y]
		};
		this.broadcast(syncAction);
	}

	#updatePlayerPosition(peerId: string, x: number, y: number) {
		players.update((players) => {
			const player = players.get(peerId);
			if (player) {
				player.x = x;
				player.y = y;
			}
			return players;
		});
	}

	#handlePlayerShoot(action: ActionPlayerShoot) {
		shoots.update((shoots) => [...shoots, action.data]);
	}

	handleData(peerId: string, action: Actions) {
		switch (action.action) {
			case BroadcastActions.SYNC_PLAYERS:
				this.syncPlayers(action);
				break;
			case BroadcastActions.SYNC_POSITIONS:
				this.#updatePlayerPosition(peerId, action.data[0], action.data[1]);
				break;
			case BroadcastActions.PLAYER_SHOOT:
				this.#handlePlayerShoot(action);
				break;
			default:
				break;
		}
	}

	createShoot(playerId: string, playerX: number, playerY: number, shootX: number, shootY: number) {
		const syncAction: ActionPlayerShoot = {
			action: BroadcastActions.PLAYER_SHOOT,
			data: {
				id: uuidv4(),
				playerId,
				from: {
					x: playerX,
					y: playerY
				},
				to: {
					x: shootX,
					y: shootY
				}
			}
		};
		// TODO, broadcast optimization to only in radio players
		this.broadcast(syncAction, SHOOT_BROADCAST_RADIO);
		this.#handlePlayerShoot({
			...syncAction,
			data: {
				...syncAction.data,
				from: {
					x: 0,
					y: 0
				}
			}
		});
	}

	destroy() {
		console.log('DESTROY');
	}
}
