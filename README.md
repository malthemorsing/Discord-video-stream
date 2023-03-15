## Discord bot video
Fork: [Discord-video-experiment](https://github.com/mrjvs/Discord-video-experiment)

## Features
 - Playing vp8 video in a voice channel (`go live`, or webcam video)
 - Transcoding video to vp8 and audio to opus (using ffmpeg)
 - Screensharing using Puppeteer

## Implementation
What I implemented and what I did not.

#### Video codecs
 - [X] VP8
 - [ ] VP9
 - [ ] H.264

#### Packet types
 - [X] RTP (sending of realtime data)
 - [ ] RTX (retransmission)

#### Connection types
 - [X] Regular Voice Connection
 - [X] Go live

#### Extras
 - [X] Figure out rtp header extensions (discord specific) (discord seems to use one-byte RTP header extension https://www.rfc-editor.org/rfc/rfc8285.html#section-4.2)

## Usage
Install the package:
```
npm install @dank074/discord-video-stream
```

Create a new streamer client:
```typescript
const client = new StreamerClient();
client.login('TOKEN HERE');
```

Make client join a voice channel and create a stream:
```typescript
await client.joinVoice("GUILD ID HERE", "CHANNEL ID HERE");

const streamUdpConn = await client.createStream();
```

Start sending media over the udp connection:
```typescript
streamUdpConn.voiceConnection.setSpeaking(true);
streamUdpConn.voiceConnection.setVideoStatus(true);
try {
    const res = await streamLivestreamVideo("DIRECT VIDEO URL OR READABLE STREAM HERE", streamUdpConn);

    console.log("Finished playing video " + res);
} catch (e) {
    console.log(e);
} finally {
    streamUdpConn.voiceConnection.setSpeaking(false);
    streamUdpConn.voiceConnection.setVideoStatus(false);
}
```
## Running example
`example/src/config.json`:
```json
"token": "SELF TOKEN HERE",
"acceptedAuthors": ["USER_ID_HERE"],
```

1. Configure your `config.json` with your accepted authors ids, and your self token
2. Generate js files with ```npm run build```
3. Start program with: ```npm run start```
3. Start streaming with commands: 

for go-live
```
$play-live <Direct video link> <Voice channel Url>
```
or for cam
```
$play-cam <Direct video link> <Voice channel Url>
```
or for screensharing using puppeteer
```
$play-screen <website url> <Voice channel url>
```
for example:
```
$play-live http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 https://discord.com/channels/<guild_id>/<channel_id>
```

You can get the channel url by right clicking the voice channel and selecting `Copy Link`

![image](https://user-images.githubusercontent.com/25986048/219265909-8b3f598b-1dd9-40a8-b0ec-acf0bcc4dfd8.png)

## FAQS
- Can I stream on existing voice connection (CAM) and in a go-live connection simultaneously?

Yes, just send the media packets over both udp connections. The voice gateway expects you to signal when a user turns on their camera, so make sure you signal using `client.signalVideo(guildId, channelId, true)` before you start sending cam media packets.