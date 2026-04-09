export type CelinicaProfile = {
  id: string;
  title: string;
  animeMirror: string;
  artists: string[];
  fortune: string;
  lastWords: string;
};

export const CELINICA_PROFILES: CelinicaProfile[] = [
  {
    id: "honored_one",
    title: "The Honored One",
    animeMirror:
      "You move like the main character who already knows they win. Calm steps, cruel precision, and a little smile that says you saw this ten moves ago. Other players are trying to play League; you’re reenacting your favorite fight scene in slow motion.",
    artists: ["The Weeknd", "Lana Del Rey", "Kendrick Lamar"],
    fortune:
      "You are destined to have games where the map bends around you; teammates will swear you’re smurfing even when you’re exhausted and half-asleep. Your power spike comes the moment you stop doubting yourself and start playing exactly as arrogantly as your instincts demand.",
    lastWords: "You prayed for a miracle; I simply decided to arrive."
  },

  {
    id: "oracle_in_pink",
    title: "The Oracle in Pink",
    animeMirror:
      "You read the map like a romance tragedy, already knowing who will be betrayed and who will be saved. You are soft in voice and ruthless in timing, the pastel-colored prophet who pings danger a full minute before disaster arrives.",
    artists: ["Taylor Swift", "Billie Eilish", "Gracie Abrams"],
    fortune:
      "Your climb is written in quiet streaks, not flashy explosions; a slow, stubborn rise that looks like fate pretending to be coincidence. One day you will queue up, play like it’s nothing, and only realize afterward that you crossed the rank you once thought was unreachable.",
    lastWords: "I saw the ending long before you ever heard the first line."
  },

  {
    id: "blossom_hashira",
    title: "The Blossom Hashira",
    animeMirror:
      "You fight like cherry blossoms in a storm: delicate at a glance, lethal when the wind picks up. There is a sweetness to your plays right before they turn violent, the kind of beauty that makes people forget to be afraid until the screen goes gray.",
    artists: ["BTS", "Ariana Grande", "Doja Cat"],
    fortune:
      "You will always be drawn to champions that twirl, dash, or dance before they kill, and that flair will be the reason you win games you had no right to touch. When you finally learn when not to fight, your LP graph will look like a sword slash straight upward.",
    lastWords: "I smiled so gently you never noticed the blade in the bloom."
  },

  {
    id: "smile_behind_the_curse",
    title: "The Smile Behind the Curse",
    animeMirror:
      "You’re the one who laughs when the game is doomed and still finds a way to make it winnable. There’s mischief in your pathing and a quiet madness in the way you walk into chaos, certain that if disaster must happen, you may as well be the one conducting it.",
    artists: ["Olivia Rodrigo", "SZA", "Post Malone"],
    fortune:
      "Your climb will be chaotic, full of cursed drafts and miracle comebacks that only you believed in. The more you accept that you thrive in doomed games, the more the universe will hand you 0–10 lanes and ask, ‘So… can you fix this too?’",
    lastWords:
      "If everything is falling apart, let me be the one who pulls the thread."
  },

  {
    id: "beautiful_catastrophe",
    title: "The Beautiful Catastrophe",
    animeMirror:
      "You are the walking definition of ‘this shouldn’t work but it did’. Your style is a car crash in slow motion, glittering and horrifying, where the enemy team can’t decide whether to report you or honor you when the Nexus finally explodes.",
    artists: ["Rihanna", "Dua Lipa", "Bring Me The Horizon"],
    fortune:
      "Your future games will swing violently between genius and grief, but your ceiling is higher than anyone who plays safe. Once you learn which risks are art and which are self-sabotage, your name will sit in a rank that once felt like a punchline.",
    lastWords:
      "If I’m going down in flames, I’m taking the skyline with me."
  },

  {
    id: "baroness_quiet_ruin",
    title: "The Baroness of Quiet Ruin",
    animeMirror:
      "You do not scream, you suffocate. Gold leads appear on your side of the scoreboard like mold in the dark, quietly spreading while everyone is busy arguing in chat. By the time they notice you, the map is already arranged for their funeral.",
    artists: ["Lorde", "Hozier", "The Neighbourhood"],
    fortune:
      "Your rise will be built on controlled games where the enemy never understands how they lost. Patience will be your deadliest weapon; when you stop forcing plays for fun and start letting others misplay first, your rank will climb like ivy around their broken towers.",
    lastWords:
      "I didn’t crush you; I simply removed every place you could breathe."
  },

  {
    id: "jungler_he_warned_you_about",
    title: "The Jungler He Warned You About",
    animeMirror:
      "You are the obsession, the late-night duo partner their ex still stalks on op.gg. Your ganks are red flags with perfect mechanics attached, impossible to resist and somehow always arriving right when common sense says recall.",
    artists: ["Drake", "Travis Scott", "Bad Bunny"],
    fortune:
      "Your path is lined with people who underestimate you once and never queue with you again without a ban ready. As you lean into your confidence and stop apologizing for being the win condition, your games will start ending faster than the arguments about whose fault it was.",
    lastWords:
      "You weren’t in danger until you decided to follow me into the river."
  }
];
