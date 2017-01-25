const Eris = require('eris')
const config = require('./json/config.json')
const client = new Eris(config.token, config.options)

const schedule = require('node-schedule')
const util = require('util')
const fs = require('fs')

const default_prefix = "--"

var stats_messages

var guilds_list = require('./json/guilds.json')
var commands = {}
client.all_usage = require('./json/usage.json')
client.usage = {
  "all": 0
}

for (cmd of require('./util/consts.json').cmdlist) {
  commands[cmd] = require(`./commands/${cmd}`)
  client.usage[cmd] = 0
  client.all_usage[cmd] = isNaN(client.all_usage[cmd]) ? 0 : client.all_usage[cmd]
}

function Helper(prefix) {
  this.prefix = prefix

  this.log = (message, text) => {
    require('util').log(`${message.channel.guild.name}/${message.channel.name}: ${text}`)
  }

  this.handle = (message, err) => {
    let result = err.toString().split(' ')[1]
    if (result == '400') {
      this.log(message, "probably don't have permissions to embed here")
    } else if (result == '403') {
      this.log(message, "probably don't have permissions to send messages here")
    } else {
      this.log(message, err.toString())
    }
  }
}

function write_guilds_list(object_to, callback) {
  fs.writeFile('./json/guilds.json', JSON.stringify(object_to), err => {
    if (err) util.log(err)
    callback();
  })
}

var write_usage_stats = schedule.scheduleJob('*/10 * * * *', () => {
  fs.writeFile('./json/usage.json', JSON.stringify(client.all_usage), (err) => {
    if (err) util.log(err)
  })
})

process.on('exit', (code) => {
  util.log(`Exiting with code ${code}`)
  fs.writeFileSync('./json/usage.json', JSON.stringify(client.all_usage))
})

client.on('ready', () => {
  util.log('listen-bot ready.')
  client.shards.forEach(shard => {
    shard.editStatus("online", {"name": `${default_prefix}info | ${default_prefix}help [${shard.id + 1}/${client.shards.size}]`})
  })

  stats_messages = schedule.scheduleJob('*/15 * * * *', () => {
    client.editMessage(config.edit_channel, config.shard_edit_message, {
      "embed": {
        "description": require('./util/shardinfo_helper')(client)
      }
    }).catch(err => util.log(err))
    client.editMessage(config.edit_channel, config.stats_edit_message, {
      "embed": require('./util/stats_helper')(client)
    }).catch(err => util.log(err))
  })
})

client.on('guildCreate', guild => {
  util.log(`${guild.id}/${guild.name}: joined guild on shard ${guild.shard.id}`)

  util.log('  creating guild object')
  guilds_list[guild.id] = {
    "name": guild.name,
    "prefix": default_prefix,
    "starboard": 'none',
    "starboard_emoji": "⭐",
    "disabled": {}
  }

  write_guilds_list(guilds_list, () => {
    util.log('  wrote new guild config successfully')
  })
})

client.on('guildUpdate', guild => {
  if (guilds_list[guild.id].name != guild.name) {
    util.log(`${guild.id}/${guild.name}: guild updated, modifying name`)
    guilds_list[guild.id].name = guild.name
    write_guilds_list(guilds_list, () => {
      util.log('  wrote new guild config successfully')
    })
  }
})

client.on('guildDelete', guild => {
  util.log(`${guild.id}/${guild.name}: left guild`)
  delete guilds_list[guild.id]
  
  write_guilds_list(guilds_list, () => {
    util.log('  removed guild successfully')
  })
})

client.on('messageCreate', message => {
  if (!message.channel.guild) return

  client.guilds_list = guilds_list
  _prefix = guilds_list[message.channel.guild.id].prefix
  _helper = new Helper(_prefix)

  if (message.author.id == client.user.id) return
  if (message.content.startsWith(_prefix) || message.content.startsWith(default_prefix)) {
    message.content = message.content.replace(default_prefix, "").replace(_prefix, "").trim()

    const command = message.content.split(' ').shift()
    let disabled_list = client.guilds_list[message.channel.guild.id].disabled[message.channel.id]
    if (disabled_list && disabled_list.indexOf(command) != -1) {
      _helper.log(message, `permissions error in command ${command}`)
    } else {
      if (command in commands) {
        commands[command](message, client, _helper)
        client.usage['all'] += 1
        client.usage[command] += 1
        client.all_usage['all'] += 1
        client.all_usage[command] += 1
        
      } else {
        _helper.log(message, `malformed command used`)
      }
    }
  }
})

client.connect()
