import { type DataConnection, Peer } from 'peerjs';
import { get, writable } from 'svelte/store';

type Player = {
	name: string;
	x: number;
	y: number;
};

enum BroadcastActions {
	SYNC_PLAYERS,
	SYNC_POSITIONS
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

type Actions = ActionSyncPlayer | ActionSyncPositions;

export default class Game {
	id: string = '';
	peer?: Peer;
	isHost = writable(false);
	ready = writable(false);
	data = writable('');
	players = writable<Map<string, Player>>(new Map());
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
						this.players.update((players) => {
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
						this.players.update((players) => {
							players.delete(conn.peer);
							return players;
						});
					});
					conn.on('iceStateChanged', (status) => {
						if (status === 'disconnected' || status === 'closed' || status === 'failed') {
							this.cons.delete(conn.peer);
							this.players.update((players) => {
								players.delete(conn.peer);
								return players;
							});
						}
					});
				});
			});
			this.players.update((players) => {
				players.set(this.id, { name: '', x: 0, y: 0 });
				return players;
			});
			this.isHost.set(true);
			this.ready.set(true);
			this.peer = peer;
		} catch (error) {
			this.isHost.set(false);
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
			this.players.update((players) => {
				players.set(this.id, { name: '', x: 0, y: 0 });
				players.set(gameId, { name: '', x: 0, y: 0 });
				return players;
			});
			this.ready.set(true);
		});
		peer.on('connection', (conn) => {
			conn.on('open', () => {
				this.cons.set(conn.peer, conn);
				this.players.update((players) => {
					players.set(conn.peer, { name: '', x: 0, y: 0 });
					return players;
				});
			});
			conn.on('data', (data) => {
				this.handleData(conn.peer, data as Actions);
			});
			conn.on('close', () => {
				this.cons.delete(conn.peer);
				this.players.update((players) => {
					players.delete(conn.peer);
					return players;
				});
			});
			conn.on('iceStateChanged', (status) => {
				if (status === 'disconnected' || status === 'closed' || status === 'failed') {
					this.cons.delete(conn.peer);
					this.players.update((players) => {
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
			this.players.update((players) => {
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
			this.players.update((players) => {
				players.delete(conn.peer);
				return players;
			});
		});
		conn.on('iceStateChanged', (status) => {
			if (status === 'disconnected' || status === 'closed' || status === 'failed') {
				this.players.update((players) => {
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

	broadcast(action: Action) {
		// console.log('BROADCAST', action, this.cons);
		this.cons.forEach((conn) => conn.send(action));
	}

	broadcastSyncPlayers() {
		const syncAction: ActionSyncPlayer = {
			action: BroadcastActions.SYNC_PLAYERS,
			data: Array.from(get(this.players).keys())
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
		this.players.update((players) => {
			const player = players.get(peerId);
			if (player) {
				player.x = x;
				player.y = y;
			}
			return players;
		});
	}

	handleData(peerId: string, action: Actions) {
		switch (action.action) {
			case BroadcastActions.SYNC_PLAYERS:
				this.syncPlayers(action);
				break;
			case BroadcastActions.SYNC_POSITIONS:
				this.#updatePlayerPosition(peerId, action.data[0], action.data[1]);
			default:
				break;
		}
		console.log('handleData', action);
	}

	destroy() {
		console.log('DESTROY');
	}
}
