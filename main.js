const fs = require ('fs')

const config = JSON.parse (fs.readFileSync ('./config.json', { encoding: 'utf-8' }))
const config_messages = require('./config-messages')

const Discord = require ('discord.js');
const bot = new Discord.Client ();

const CCommands = require ('./CCommands')
const cmds = new CCommands

const rls_api = require ('rls-api');
var rls = new rls_api.Client ({ token: config.rls.token })

const cron = require ('cron').CronJob;
let update_job

const lokijs = require ('lokijs')

let guild
let roles = new Map

bot.on ('ready', () => {
  guild = bot.guilds.get (config.discord.guildid)
  console.assert (undefined !== guild, config_messages.bot_on_ready_guild_not_found)
  
  roles = new Map (config.discord.roles.map (e => {
    const role = guild.roles.get (e[1])
    console.assert (undefined !== role, config_messages.bot_on_ready_role_not_found)

    return [ e[0], role ]
  }))

  update_users_ranks ()

  try {
    update_job = new cron ('00 00 00 * * *', update_users_ranks, null, true)
  } catch (e) {
    console.error (e)
  }

  console.log (`Logged in as ${bot.user.tag}!`)
});

bot.on ('guildMemberRemove', member => {
  const user = users.findOne ({ userid: member.id })
  users.remove (user)
})

bot.on ('message', msg => {
  if (!msg.content.startsWith ('!') || msg.author.bot) {
    return
  }

  cmds.execute (msg)
});

cmds.add ('reg', (msg, [steamid]) => {
  if (null !== users.findOne ({ userid: msg.author.id })) {
    return msg.reply (config_messages.cmd_reg_already_registered).catch (console.error)
  }
  if (undefined === steamid) {
    return msg.reply (config_messages.cmd_reg_example).catch (console.error)
  }

  rls.getPlayer (steamid, rls_api.platforms.STEAM, function (status, data) {    
    if (200 !== status || undefined === data.rankedSeasons) {
      if (404 === status) {
        return msg.reply (config_messages.cmd_reg_user_status_not_found).catch (console.error)
      }
      return msg.reply (config_messages.cmd_reg_rls_error).catch (console.error)
    }

    const data_arr = Object.values (data.rankedSeasons)
    if (
      !data_arr.length ||
      undefined === data_arr[data_arr.length - 1]['13'] ||
      undefined === data_arr[data_arr.length - 1]['13'].rankPoints
    ) {
      return msg.reply (config_messages.cmd_reg_not_have_games).catch (console.error)
    }
    
    const user = {
      userid: msg.author.id,
      rankPoints: data_arr[data_arr.length - 1]['13'].rankPoints,
      steamid
    }

    users.insertOne (user)
    msg.member.addRole (roles.get (calculate_rank_role (user.rankPoints)).id).catch (console.error)

    msg.reply (config_messages.cmd_reg_regiser_complete).catch (console.error)
  }) 
})

const calculate_rank_role = points => {
  return Math.max.apply (Math, [...roles.keys ()].filter (e => e < points))
}

const update_users_ranks = () => {
  const roles_ids = [...roles.values ()].map (e => e.id)

  for (const user of users.data) {
    rls.getPlayer (user.steamid, rls_api.platforms.STEAM, function (status, data) {    
      if (200 !== status || undefined === data.rankedSeasons) {
        return
      }

      let rls_user
      const data_arr = Object.values (data.rankedSeasons)
      if (
        !data_arr.length ||
        undefined === (rls_user = data_arr[data_arr.length - 1]['13']) ||
        undefined === data_arr[data_arr.length - 1]['13'].rankPoints
      ) {
        return
      }

      // change data
      if (user.rankPoints !== rls_user.rankPoints) {
        user.rankPoints = rls_user.rankPoints
        
        // update
        users.update (user)
        
        // change roles
        const member = guild.members.get (user.userid)
        if (!member) { return }

        member.setRoles ([...[...member.roles].map (e => e[0]).filter (function (e) { return this.indexOf (e) < 0 }, roles_ids), roles.get (calculate_rank_role (user.rankPoints)).id]).catch (console.error)
      }
    })
  }
}

let users
const loki = new lokijs ('users.db', {
  autoload: true,
	autoloadCallback : () => {
    users = loki.getCollection ('users')
    if (null === users) {
      users = loki.addCollection ('users', {
        unique: ['userid']
      })      
      console.log ('[DB] has created')
    } else {
      console.log ('[DB] found. Has loaded')
    }

    bot.login (config.discord.token)
  },
	autosave: true, 
	autosaveInterval: 4000
})