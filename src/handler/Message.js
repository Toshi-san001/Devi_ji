import { join } from 'path'
import { URL } from 'url'
export default class MessageHandler {
    commands = new Map()
    aliases = new Map()

    constructor(client) {
        this.client = client
    }

    handler = async (M) => {
        const context = this.parseArgs(M.content)
        const { args, cmd } = context
        if (!M.content.startsWith(this.client.config.prefix))
            return void this.client.log.notice(
                `(MSG): from ${M.sender.username} in ${M.group?.title || 'Direct Message'}`
            )
        const isCommand = M.content.startsWith(this.client.config.prefix)
        if (!isCommand) return
        const command = this.commands.get(cmd) || this.aliases.get(cmd)

        this.client.log.notice(`(CMD): ${cmd} from ${M.sender.username} in ${M.group?.title || 'Direct Message'}`)
        if (!command) return void M.reply('No Command Found! Try using one from the help list.')
        if (!command.config?.dm && M.chat === 'dm') return void M.reply('This command can only be used in groups')
        if (M.chat === 'group' && command.config?.adminOnly && !M.isAdminMessage)
            return void M.reply(`Only admins are allowed to use this command`)
        try {
            await command.exec(M, context)
        } catch (err) {
            return void this.client.log.error(err.message)
        }
    }

    loadCommands = async () => {
        this.client.log.info('Loading Commands...')
        const __dirname = new URL('.', import.meta.url).pathname
        const path = join(__dirname, '..', 'commands')
        const files = this.client.util.readdirRecursive(path)
        for (const file of files) {
            const filename = file.split('/')
            if (!filename[filename.length - 1].startsWith('_')) {
                const command = new (Object.values(await import(file))[0])(this.client, this)
                this.commands.set(command.config.command, command)
                if (command.config.aliases) command.config.aliases.forEach((alias) => this.aliases.set(alias, command))
                this.client.log.info(`Loaded: ${command.config.command} from ${command.config.category}`)
            }
        }
        this.client.log.notice(`Successfully Loaded ${this.commands.size} Commands`)
    }

    parseArgs = (raw) => {
        const args = raw.split(' ')
        const cmd = args.shift()?.toLocaleLowerCase().slice(this.client.config.prefix.length) ?? ''
        const text = args.join(' ')
        const flags = {}
        for (const arg of args) {
            if (arg.startsWith('--')) {
                const [key, value] = arg.slice(2).split('=')
                flags[key] = value
            } else if (arg.startsWith('-')) {
                flags[arg] = ''
            }
        }
        // prettier-ignore
        return { cmd, text, flags, args, raw }
    }
}
