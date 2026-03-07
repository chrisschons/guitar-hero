# Guitar Tab Practice

A React web app for practicing guitar with scrolling tab notation and a metronome.

## Features

- **Horizontal scrolling tab display** - Smooth continuous scroll synced to BPM
- **Metronome** - Audio click + visual beat indicators (4/4 time)
- **BPM control** - Adjustable tempo from 40-200 BPM
- **5 Pentatonic positions** - Practice all 5 boxes of the minor pentatonic scale

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Usage

1. Select a pentatonic position from the dropdown
2. Set your desired BPM
3. Press Play to start the metronome and tab scrolling
4. Practice along with the scrolling tab!

## Pentatonic Positions (A Minor)

- **Position 1**: Frets 5-8 (root on 6th string)
- **Position 2**: Frets 7-10
- **Position 3**: Frets 9-12
- **Position 4**: Frets 12-15
- **Position 5**: Frets 14-17

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- Framer Motion for animations
- Web Audio API for metronome sounds
