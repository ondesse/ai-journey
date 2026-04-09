# LoL Draft Tool

A League of Legends draft simulator with data-driven champion selection based on Master+ winrate statistics from LoLalytics.

## Features

- **Data-Driven Drafting**: Uses comprehensive matchup and synergy data from LoLalytics (Master+ tier)
- **Smart Counter Picking**: Automatically suggests champions that counter the enemy team
- **Team Composition**: Enforces balanced team compositions (ADC, APC, Tank requirements)
- **Pick Swapping**: Swap pick order with teammates during the draft
- **Real-Time Timers**: 12-second timers for enemy/teammate picks, 20-second timer for your picks

## Running as Desktop App (Electron)

### Development

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run electron:dev
```

This will start the Next.js dev server and open the Electron app.

### Building for Distribution

#### Windows
```bash
npm run electron:build:win
```

This creates a Windows installer in the `dist` folder that you can share with friends.

#### macOS
```bash
npm run electron:build:mac
```

#### Linux
```bash
npm run electron:build:linux
```

#### All Platforms
```bash
npm run electron:build
```

The built installer/executable will be in the `dist` folder.

## Running as Web App

### Development
```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

### Production Build
```bash
npm run build
npm start
```

## How to Share the App

After building, you'll find the installer in the `dist` folder:
- **Windows**: `LoL Draft Tool Setup X.X.X.exe` - Share this file
- **macOS**: `LoL Draft Tool-X.X.X.dmg` - Share this file
- **Linux**: `LoL Draft Tool-X.X.X.AppImage` - Share this file

Your friends just need to:
1. Download the installer
2. Run it to install
3. Launch "LoL Draft Tool" from their applications

## Data

The app uses matchup data scraped from LoLalytics stored in `app/data/matchup_data.json`. This includes:
- Matchup winrates (champion vs champion)
- Synergy winrates (favorable role matchups)

## License

Private project - not for distribution beyond personal use.
