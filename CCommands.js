module.exports = class CCommands {
	constructor () {
		this._cmds = new Map
	}
	add (name, func) {
		this._cmds.set (name, func)
	}
	async execute (message) {
		const args = message.content.slice(1).trim().split(/ +/g);
		const command = args.shift().toLowerCase();

		const cmd = this._cmds.get (command)
		if (!cmd) { return }

		cmd (message, args)
	}
}
// 【Avanna】My Immortal - Vocaloid Cover
// https://www.youtube.com/watch?v=o1pgbId3Bmw