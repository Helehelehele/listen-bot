async function edit_trivia(pg, channel, ctx) {
    if (ctx.client.trivia.channels.includes(ctx.gcfg.trivia)) ctx.client.trivia.channels.splice(ctx.client.trivia.channels.indexOf(ctx.gcfg.trivia), 1);

    try {
        let res = await pg.query({
            "text": "UPDATE public.guilds SET trivia = $1 WHERE id = $2",
            "values": [channel || 0, ctx.guild.id]
        });

        let msg = channel ? ctx.strings.get("admin_trivia_enable", channel) : ctx.strings.get("admin_trivia_disable");
        return ctx.success(msg);
    } catch (err) {
        console.error(err);
        return ctx.failure(ctx.strings.get("bot_generic_error"));
    }
}

const subcommands = {
    botspam: async function(ctx) {
        if (ctx.content) {
            let channel = ctx.message.channelMentions.length ? ctx.message.channelMentions[0] : 0;

            try {
                let res = await ctx.client.pg.query({
                    "text": "UPDATE public.guilds SET botspam = $1 WHERE id = $2",
                    "values": [channel, ctx.guild.id]
                });

                channel = channel == 0 ? "`none`" : `<#${channel}>`;
                return ctx.success(ctx.strings.get("admin_botspam_change", channel));
            } catch (err) {
                console.error(err);
                return ctx.failure(ctx.strings.get("bot_generic_error"));
            }
        } else {
            return ctx.failure(ctx.strings.get("bot_bad_syntax"));
        }
    },
    cooldowns: async function(ctx) {
        if (ctx.content) {
            let options = ctx.content.split(" ");
            if (["channel", "member"].indexOf(options[0]) != -1 && !isNaN(options[1])) {
                let limit = options[1];

                try {
                    let res = await ctx.client.pg.query({
                        "text": `UPDATE public.guilds SET ${options[0].charAt(0)}limit = $1 WHERE id = $2`,
                        "values": [limit, ctx.guild.id]
                    });

                    return ctx.success(ctx.strings.get("admin_cooldowns_set", options[0], options[1]))
                } catch (err) {
                    console.error(err);
                    return ctx.failure(ctx.strings.get("bot_generic_error"));
                }
            }
        } else {
            return ctx.failure(ctx.strings.get("bot_bad_syntax"));
        }
    },
    disable: async function(ctx) {
        let allowed = [];

        for (let command in ctx.client.commands) {
            command = ctx.client.commands[command];
            if (["admin", "owner", "meta"].includes(command.category)) continue;

            allowed.push(command.name);
        }

        try {
            let res = await ctx.client.pg.query({
                "text": "SELECT * FROM guilds WHERE id = $1",
                "values": [ctx.guild.id]
            });

            let disabled = res.rows[0].disabled || {};
            let oldlist = disabled[ctx.channel.id] || [];

            let toDisable = ctx.options.filter((cmd) => allowed.includes(cmd));
            oldlist = oldlist.concat(toDisable);

            let newlist = oldlist.filter((item, index, array) => array.indexOf(item) === index);
            disabled[ctx.channel.id] = newlist;

            await ctx.client.pg.query({
                "text": "UPDATE public.guilds SET disabled = $1 WHERE id = $2",
                "values": [disabled, ctx.guild.id]
            });

            let prettylist = newlist.map(item => `\`${item}\``).join(" ");

            if (newlist.length) {
                return ctx.success(ctx.strings.get("admin_disable_list", prettylist));
            } else {
                return ctx.success(ctx.strings.get("admin_disable_none"));
            }
        } catch (err) {
            console.error(err);
            return ctx.failure(ctx.strings.get("bot_generic_error"));
        }
    },
    enable: async function(ctx) {
        try {
            let res = await ctx.client.pg.query({
                "text": "SELECT * FROM guilds WHERE id = $1",
                "values": [ctx.guild.id]
            });

            let disabled = res.rows[0].disabled;
            let oldlist = disabled[ctx.channel.id];

            if (!disabled || !oldlist) {
                return ctx.failure(ctx.strings.get("admin_enable_error"));
            }

            for (let val of ctx.options) {
                if (oldlist.includes(val)) {
                    oldlist.splice(oldlist.indexOf(val), 1);
                }
            }

            await ctx.client.pg.query({
                "text": "UPDATE public.guilds SET disabled = $1 WHERE id = $2",
                "values": [disabled, ctx.guild.id]
            });

            let prettylist = oldlist.map(item => `\`${item}\``).join(" ");

            if (oldlist.length > 0) {
                return ctx.success(ctx.strings.get("admin_disable_list", prettylist));
            } else {
                return ctx.success(ctx.strings.get("admin_disable_none"));
            }
        } catch (err) {
            console.error(err);
            return ctx.failure(ctx.strings.get("bot_generic_error"));
        }
    },
    locale: async function(ctx) {
        if (ctx.content) {
            let available = Object.keys(ctx.client.locale);
            if (available.includes(ctx.content)) {

                try {
                    let res = await ctx.client.pg.query({
                        "text": "UPDATE public.guilds SET locale = $1 WHERE id = $2",
                        "values": [ctx.content, ctx.guild.id]
                    });

                    return ctx.success(ctx.strings.get("admin_locale_change", ctx.content));
                } catch (err) {
                    console.error(err);
                    return ctx.failure(ctx.strings.get("bot_generic_error"));
                }
            } else {
                return ctx.failure(ctx.strings.get("admin_locale_failure", available.join(", ")));
            }
        } else {
            return ctx.failure(ctx.strings.get("admin_locale_failure", available.join(", ")));
        }
    },
    prefix: async function(ctx) {
        if (ctx.content) {
            try {
                let res = await ctx.client.pg.query({
                    "text": "UPDATE public.guilds SET prefix = $1 WHERE id = $2",
                    "values": [ctx.content, ctx.guild.id]
                });

                return ctx.success(ctx.strings.get("admin_prefix_change", ctx.content));
            } catch (err) {
                console.error(err);
                return ctx.failure(ctx.strings.get("bot_generic_error"));
            }
        } else {
            return ctx.send("Invalid syntax.");
        }
    },
    trivia: async function(ctx) {
        if (ctx.message.channelMentions.length > 0) {
            return edit_trivia(ctx.client.pg, ctx.message.channelMentions[0], ctx);
        } else if (ctx.options.join(" ").trim() == "here") {
            return edit_trivia(ctx.client.pg, ctx.channel.id, ctx);
        } else if (ctx.options.join(" ").trim() == "none") {
            return edit_trivia(ctx.client.pg, null, ctx);
        } else {
            return ctx.failure(ctx.strings.get("admin_trivia_bad_syntax"))
        }
    },
    threshold: async function(ctx) {
        let count = parseInt(ctx.options.join(" "));
        if (!isNaN(count) && count > 0 && count < 6) {
            try {
                let res = await ctx.client.pg.query({
                    text: "UPDATE public.guilds SET threshold = $1 WHERE id = $2;",
                    values: [count, ctx.guild.id]
                });
            } catch (err) {
                console.error(err);
                return ctx.failure(ctx.strings.get("bot_generic_error"));
            }

            return ctx.success("Stack threshold updated.");
        } else {
            return ctx.failure("Please provide a threshold between 1 and 5.");
        }
    }
}

async function checks(client, member) {
    return member.permission.has("manageMessages");
}

async function exec(ctx) {
    delete ctx.client.gcfg[ctx.guild.id];
    const subcommand = ctx.options[0];
    if (subcommands.hasOwnProperty(subcommand)) {
        ctx.content = ctx.options.slice(1).join(" ");
        ctx.options = ctx.options.slice(1);
        return subcommands[subcommand](ctx);
    } else {
        let disabled_list = ctx.gcfg.disabled ? ctx.gcfg.disabled[ctx.channel.id] : undefined;
        let prettylist = disabled_list ? disabled_list.map(item => `\`${item}\``).join(" ") : "";
        prettylist = prettylist.length > 0 ? ctx.strings.get("admin_display_disabled_commands", prettylist) : ctx.strings.get("admin_display_disabled_commands_none");
        return ctx.send({
            "embed": {
                "description": [
                    ctx.strings.get("admin_display_channel_specific_cooldowns", ctx.gcfg.climit),
                    ctx.strings.get("admin_display_member_specific_cooldowns", ctx.gcfg.mlimit),
                    ctx.strings.get("admin_display_custom_prefix", ctx.gcfg.prefix),
                    ctx.strings.get("admin_display_trivia_channel", ctx.gcfg.trivia == 0 ? "none" : `<#${ctx.gcfg.trivia}>`),
                    prettylist
                ].join("\n")
            }
        });
    }
}

module.exports = {
    name: "admin",
    category: "admin",
    aliases: ["a"],
    ignoreCooldowns: true,
    checks,
    exec
};
