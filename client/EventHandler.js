function handleGatewayEvent(client, event, data) {
    if (event === "VOICE_STATE_UPDATE") {
        if (data.user_id === client.botId) {
            if (typeof client.voiceGuild[data.guild_id] !== "undefined") {
                // transfer session data to voice connection
                client.voiceGuild[data.guild_id].setSession(data.session_id);
            }
        }
    } else if (event === "VOICE_SERVER_UPDATE") {
        // transfer voice server update to voice connection
        client.voiceGuild[data.guild_id].setTokens(data.endpoint, data.token);
    }
}

module.exports = {
    handleGatewayEvent
};
