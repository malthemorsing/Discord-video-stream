const events = require('events');
const { Client } = require('discord.js-selfbot-v13');
const { VoiceConnection } = require("../voice/VoiceConnection");
const { handleGatewayEvent } = require("./EventHandler");

const gatewayOpCodes = {
    event: 0,
    heartbeat: 1,
    identify: 2,
    status: 3,
    voice: 4,
    hello: 10,
    heartbeat_ack: 11,
}

class BotClient extends Client {
    constructor(token) {
        super();
        this.token = token;
        // keeps track of voice connections
        this.voiceGuild = {};
        // starts event handling
        this.events = new events.EventEmitter();
    }

    login(token) {
        super.login(token)
        .then(() => {
            this.bot = this.user.bot;
            this.botId = this.user.id;
            this.on('raw', packet => {
                handleGatewayEvent(this, packet.t, packet.d);
            });
        });
    }

    sendOpcode(code, data) {
        this.ws.broadcast({
            op: code,
            d: data,
        })
    }
    
    getVoiceConnection(guild_id) {
        this.voiceGuild[guild_id];
    }

    /*
    ** set status of bot
    ** text -> Text of game the bot is playing
    */
    setStatus(text) {
        this.sendOpcode(gatewayOpCodes.status, {
            afk: false,
            status: 'online',
            game: {
                name: text,
                type: 0
            },
            since: null
        });
    }

    /*
    ** send message to channel
    ** text -> message to send
    ** channelId -> channel id
    */
    sendMessage(text, channelId) {
        this.channels.cache.get(channelId).send(text);
    }

    /*
    ** get user by userid
    ** userid -> user id or "@me"
    */
    async getUser(userId) {
        return this.users.fetch(userId);
    }

    /*
    ** Join a voice channel
    ** guild_id -> guild id
    ** channel_id -> channel id
    */
    joinVoice(guild_id, channel_id, callback) {
        this.voiceGuild[guild_id] = new VoiceConnection(guild_id, this.botId, callback);
        this.sendOpcode(gatewayOpCodes.voice, {
            guild_id,
            channel_id,
            self_mute: false,
            self_deaf: false,
            self_video: true,
        });
    }
}

module.exports = {
    BotClient
};
