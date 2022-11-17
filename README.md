## Discord bot video
Fork: [Discord-video-experiment](https://github.com/mrjvs/Discord-video-experiment)

## features
 - Playing vp8 video in a voice channel (not `go live`, but webcam video)
 - Transcoding video and audio to vp8 (using ffmpeg)
 - Can send via streams (possible hook with youtube)

## implementation
What I implemented and what I did not.

#### Video codecs
 - [X] VP8
 - [ ] VP9
 - [ ] H.264

#### Packet types
 - [X] RTP (sending of realtime data)
 - [ ] RTX (retransmission)
 - [ ] Go live (?) (Has not been researched yet if even possible)

#### Extras
 - [ ] Figure out rtp header extensions (discord specific)

## Running example
`./example/config.js`:
```JS
module.exports = "SELFBOT TOKEN HERE"
```

in `./example`:
1. have `config.js` like above
2. run with `node .`
3. Start bot: `$play <id voice channel> <youtube video>`

