export type Player = {
	name: string;
	x: number;
	y: number;
};

export type Shoot = {
	id: string;
	playerId: string;
	from: {
		x: number;
		y: number;
	};
	to: {
		x: number;
		y: number;
	};
};
