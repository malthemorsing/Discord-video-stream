## Discord bot video
Fork: [Discord-video-experiment](https://github.com/mrjvs/Discord-video-experiment)

## features
 - Playing vp8 video in a voice channel (`go live`, or webcam video)
 - Transcoding video and audio to vp8 (using ffmpeg)

## implementation
What I implemented and what I did not.

#### Video codecs
 - [X] VP8
 - [ ] VP9
 - [ ] H.264

#### Packet types
 - [X] RTP (sending of realtime data)
 - [ ] RTX (retransmission)
 - [X] Go live

#### Extras
 - [ ] Figure out rtp header extensions (discord specific)

## Running example
`src/example/config.json`:
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

for example:
```
$play-live http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 https://discord.com/channels/<guild_id>/<channel_id>
```

You can get the channel url by right clicking the voice channel and selecting `Copy Link`
