const { BotClient: Client } = require("../client/BotClient");
const fs = require("fs");
const ytdl = require("ytdl-core");

const client = new Client();

const token = require("./config");
const video = "path video file";

async function playVideo(voice) {
    console.log("Started playing video");

    // make file streams
    const videoStream = fs.createReadStream(video);
    const audioStream = fs.createReadStream(video);

    // play audio stream
    voice.playAudioFileStream(audioStream, "mp4");

    // play video stream
    await voice.playVideoFileStream(videoStream, "mp4");

    console.log("Finished playing video");
}

function playYoutube(voice, link) {
    const stream = ytdl(link, {
        quality: 136
    });

    const audiostream = ytdl(link, {
        filter: "audioonly"
    });

    voice.playAudioFileStream(audiostream, "mp4");
    voice.playVideoFileStream(stream, "mp4");
}


// ready event
client.on("ready", () => {
    console.log(`--- ${client.user.tag} is ready ---`);
});

// message event
client.on("messageCreate", (msg) => {
    if (msg.author.bot)
        return
    if (!msg.guildId || !["721746046543331449", msg.author.id].includes(msg.author.id))
        return

    // handle messages here
    if (msg.content && msg.content.startsWith(`$play`)) {
        const args = msg.content.split(" ");
        if (args.length < 2) return;
        client.joinVoice(msg.guildId, args[1] , (vc) => {
            playYoutube(vc, args[2]);
        });
    }
});

// login
client.login(token);
