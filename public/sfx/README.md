# SFX Audio Files

This directory contains sound effect files for the application.

## Required Files

Please add the following audio files to this directory:

- `ding.mp3` - Main notification sound (MP3 format)
- `ding.ogg` - Main notification sound (OGG format) 
- `ding.wav` - Main notification sound (WAV format)

## Fallback

If local files are not available, the system will automatically fall back to the CDN source:
`https://cdn.jsdelivr.net/gh/antfu/static/sfx/notification.mp3`

## Usage

The sound system will automatically try each format in order and use the first one that works in the user's browser.
