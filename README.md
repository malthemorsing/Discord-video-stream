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
 - [X] H.264

#### Packet types
 - [X] RTP (sending of realtime data)
 - [ ] RTX (retransmission)

#### Connection types
 - [X] Regular Voice Connection
 - [X] Go live

#### Extras
 - [X] Figure out rtp header extensions (discord specific) (discord seems to use one-byte RTP header extension https://www.rfc-editor.org/rfc/rfc8285.html#section-4.2)

Extensions supported by Discord (taken from the webrtc sdp exchange)
```
"a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level"
"a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
"a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
"a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid"
"a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay"
"a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type"
"a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing"
"a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space"
"a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id"
"a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id"
"a=extmap:13 urn:3gpp:video-orientation"
"a=extmap:14 urn:ietf:params:rtp-hdrext:toffset"
```
## Requirements
Ffmpeg is required for the usage of this package. If you are on linux you can easily install ffmpeg from your distribution's package manager.

If you are on Windows, you can download it from the official ffmpeg website: https://ffmpeg.org/download.html

## Usage
Install the package, alongside its peer-dependency discord.js-selfbot-v13:
```
npm install @dank074/discord-video-stream@latest
npm install discord.js-selfbot-v13@latest
```

Create a new client, and patch its events to listen for voice gateway events:
```typescript
import { Client } from "discord.js-selfbot-v13";
import "@dank074/discord-video-stream";

const client = new Client();
client.login('TOKEN HERE');

client.patchVoiceEvents();
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
4. Join a voice channel
5. Start streaming with commands: 

for go-live
```
$play-live <Direct video link>
```
or for cam
```
$play-cam <Direct video link>
```
or for screensharing using puppeteer
```
$play-screen <website url>
```
for example:
```
$play-live http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

## FAQS
- Can I stream on existing voice connection (CAM) and in a go-live connection simultaneously?

Yes, just send the media packets over both udp connections. The voice gateway expects you to signal when a user turns on their camera, so make sure you signal using `client.signalVideo(guildId, channelId, true)` before you start sending cam media packets.
