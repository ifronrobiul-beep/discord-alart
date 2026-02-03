// NOTE: This code requires a Node.js environment with the 'discord.js' library installed
// and must be hosted on an external server to run 24/7.

// --- CONFIGURATION ---
// Prefer environment variables for secrets and deployment configuration.
const DEFAULTS = {
    DISCORD_BOT_TOKEN: "REPLACE_ME",
    YOUTUBE_CHANNEL_ID: "UC8fG2-xOc4YfjvaqKb2rjZg",
    TARGET_DISCORD_CHANNEL_ID: "1048617046453264484",
    POLLING_INTERVAL_MS: 300000, // 5 minutes
    ENABLE_EVERYONE_PING: true,
};

const CONFIG = {
    discordBotToken: process.env.DISCORD_BOT_TOKEN || DEFAULTS.DISCORD_BOT_TOKEN,
    youtubeChannelId: (process.env.YOUTUBE_CHANNEL_ID || DEFAULTS.YOUTUBE_CHANNEL_ID).trim(),
    targetDiscordChannelId: (
        process.env.TARGET_DISCORD_CHANNEL_ID || DEFAULTS.TARGET_DISCORD_CHANNEL_ID
    ).trim(),
    pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS) || DEFAULTS.POLLING_INTERVAL_MS,
    enableEveryonePing:
        (process.env.ENABLE_EVERYONE_PING || String(DEFAULTS.ENABLE_EVERYONE_PING)).toLowerCase() ===
        "true",
};

function validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!config.discordBotToken || config.discordBotToken === DEFAULTS.DISCORD_BOT_TOKEN) {
        warnings.push("DISCORD_BOT_TOKEN is not set. Using placeholder token.");
    }

    if (!/^UC[\w-]{20,}$/.test(config.youtubeChannelId)) {
        warnings.push("YOUTUBE_CHANNEL_ID looks unusual. Double-check the channel ID.");
    }

    if (!/^\d{10,}$/.test(config.targetDiscordChannelId)) {
        warnings.push("TARGET_DISCORD_CHANNEL_ID looks unusual. Double-check the channel ID.");
    }

    if (!Number.isFinite(config.pollingIntervalMs) || config.pollingIntervalMs < 60000) {
        errors.push("POLLING_INTERVAL_MS must be a number >= 60000 (1 minute).");
    }

    return { errors, warnings };
}

function log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

const { errors, warnings } = validateConfig(CONFIG);
warnings.forEach((warning) => log("WARN", warning));
if (errors.length) {
    errors.forEach((error) => log("ERROR", error));
    process.exit(1);
}

// --- Discord.js Setup (Requires 'npm install discord.js') ---
// Mocking the required Discord objects for concept display.
const discord = {
    Client: function Client() {
        this.channels = {
            cache: {
                get: (id) => ({
                    send: (payload) =>
                        log(
                            "DISCORD",
                            `Message Sent to Channel ${id}: ${payload.content || payload.embeds[0].title}`
                        ),
                }),
            },
        };
        this.login = (token) => log("DISCORD", `Attempting login with token: ${token.substring(0, 5)}...`);
        this.on = (event, callback) => {
            if (event === "ready") {
                setTimeout(callback, 250);
            }
        };
        this.user = { tag: "MockBot#0001" };
    },
    Intents: {
        FLAGS: {
            GUILDS: "GUILDS",
            GUILD_MESSAGES: "GUILD_MESSAGES",
        },
    },
};

const client = new discord.Client({
    intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES],
});

// --- YOUTUBE MOCK/CONCEPT FUNCTION ---
/**
 * In a real application, this function would use the YouTube Data API or
 * WebSub (PubSubHubbub) to check for a new upload from YOUTUBE_CHANNEL_ID.
 */
let lastPostedVideoId = null;

function generateMockVideo() {
    const fakeVideoId = `FAKE_${Date.now()}`;
    return {
        id: fakeVideoId,
        title: "⚡️ LATEST VIDEO IS LIVE: Building a 24/7 Discord Bot",
        url: `https://www.youtube.com/watch?v=${fakeVideoId}`,
        authorName: "Your Channel Name",
        thumbnailUrl: `https://i.ytimg.com/vi/${fakeVideoId}/maxresdefault.jpg`,
    };
}

function checkYouTubeForNewVideo() {
    const isNewVideo = Math.random() < 0.2; // 20% chance for simulation

    if (!isNewVideo) {
        return null;
    }

    const video = generateMockVideo();
    if (video.id === lastPostedVideoId) {
        return null;
    }

    lastPostedVideoId = video.id;
    return video;
}

// --- DISCORD SEND LOGIC ---
function createVideoEmbed(video) {
    return {
        color: 0xff0000, // YouTube Red
        title: video.title,
        url: video.url,
        author: {
            name: `${video.authorName} just uploaded!`,
            icon_url: "https://placehold.co/64x64/ff0000/white?text=Y",
        },
        description: "Be the first to watch our new content. Hit the like button!",
        thumbnail: {
            url: video.thumbnailUrl,
        },
        fields: [
            {
                name: "Watch Now!",
                value: `[Click here to jump to the video!](${video.url})`,
                inline: false,
            },
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: "Monitored by Automated YouTube Sync Bot",
        },
    };
}

function sendNotification(video) {
    const channel = client.channels.cache.get(CONFIG.targetDiscordChannelId);

    if (!channel) {
        log("ERROR", `Target channel ID ${CONFIG.targetDiscordChannelId} not found!`);
        return;
    }

    const embed = createVideoEmbed(video);
    const content = CONFIG.enableEveryonePing
        ? "@everyone Our new video is live! Check it out now!"
        : "Our new video is live! Check it out now!";

    try {
        channel.send({
            content,
            embeds: [embed],
        });
    } catch (error) {
        log("ERROR", `Failed to send Discord notification: ${error.message}`);
    }
}

// --- MAIN BOT LOOP ---
let isPolling = false;

function pollYouTube() {
    if (isPolling) {
        log("WARN", "Previous poll still running. Skipping this interval.");
        return;
    }

    isPolling = true;
    log("CHECK", `Polling YouTube at ${new Date().toLocaleTimeString()}...`);

    const newVideo = checkYouTubeForNewVideo();
    if (newVideo) {
        log("ALERT", `New video detected: ${newVideo.title}`);
        sendNotification(newVideo);
    } else {
        log("STATUS", "No new videos found.");
    }

    isPolling = false;
}

function startBotLoop() {
    log("BOT", `Starting monitoring loop for channel ${CONFIG.youtubeChannelId}...`);

    pollYouTube();
    setInterval(pollYouTube, CONFIG.pollingIntervalMs);
}

// --- INITIALIZATION ---
client.on("ready", () => {
    log("SUCCESS", `Logged in as ${client.user.tag}!`);
    startBotLoop();
});

client.login(CONFIG.discordBotToken);
