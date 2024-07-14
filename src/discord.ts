import { app, discordController } from "./index.ts";
import { Guild, User, ReadyPacket, ChatMessage, PrivateChannel } from "./types.ts";

enum DiscordPackets {
    // Client -> Server
    Heartbeat = 1,
    Identify = 2,

    // Server -> Client
    User = 0,
    InitHeartbeat = 10
}

export class DiscordController {
    api = 'https://discord.com/api/v9';

    token: string;
    ws: WebSocket;

    heartbeat_int: number;

    guilds: Guild[];
    users: User[];
    privChannels: PrivateChannel[];

    listeners: { ev: 'loaded' | 'message_create', cb: (data?: unknown) => void }[];

    constructor() {
        this.token = '';
        // just connect to a random ws server because i dont want to deal with (WebSocket | undefined)
        this.ws = new WebSocket('https://echo.websocket.org/');

        this.heartbeat_int = -1;

        this.guilds = [];
        this.privChannels = [];
        this.users = [];
        this.listeners = [];
    }

    addListener(ev: 'loaded' | 'message_create', cb: (data?: unknown) => void) {
        this.listeners.push({ ev, cb });
    }

    callListeners(ev: 'loaded' | 'message_create', data?: unknown) {
        for(let i=0;i<this.listeners.length;i++) {
            if(this.listeners[i].ev == ev) this.listeners[i].cb(data);
            app.debugLog(`calling ${this.listeners[i].ev}[${i}]`);
        }
    }

    connect(token: string) {
        this.token = token;

        this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
    }

    onOpen(this: WebSocket, _ev: Event) {
        app.debugLog(`WebSocket opened`);
    }

    // deno-lint-ignore no-explicit-any
    onMessage(this: WebSocket, ev: MessageEvent<any>) {
        const p: { t: unknown | null, s: unknown | null, op: number, d: Record<string, unknown> } = JSON.parse(ev.data);

        app.debugLog(`Packet with op=${p.op} t=${p.t} s=${p.s}`);

        switch(p.op) {
            case DiscordPackets.InitHeartbeat: {
                const data = p.d as { heartbeat_interval: number, _trace: string[] };

                discordController.heartbeat_int = setInterval((ws: WebSocket) => {
                    ws.send(JSON.stringify({op:DiscordPackets.Heartbeat,d:3}));
                }, data.heartbeat_interval, this);

                this.send(JSON.stringify({
                    op: DiscordPackets.Identify,
                    d: {
                        capabilities: 30717,
                        client_state: { guild_versions: {} },
                        compress: false,
                        presence: { status: 'unknown', since: 0, activites: [], afk: false },
                        properties: {
                            os: "Linux",
                            browser: "Chrome",
                            device: "",
                            system_locale: "en-US",
                            browser_user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                            browser_version: "124.0.0.0",
                            os_version: "",
                            referrer: "https://www.google.com/",
                            referring_domain: "www.google.com",
                            search_engine: "google",
                            referrer_current: "",
                            referring_domain_current: "",
                            release_channel: "stable",
                            client_build_number: 307392,
                            client_event_source: null,
                            design_id: 0
                        },
                        token: discordController.token
                    }
                }));
            break; }

            case DiscordPackets.User:
                switch(p.t) {
                    case 'READY': {
                        const data = p.d as ReadyPacket;

                        discordController.guilds = data.guilds;

                        // add users -- making sure to clean them
                        discordController.users = [];
                        for(const user of data.users) {
                            if(user.username.startsWith('deleted_user')) continue;
                            discordController.users.push(user);
                        }

                        discordController.privChannels = data.private_channels;

                        discordController.callListeners('loaded');
                    break; }

                    case 'READY_SUPPLEMENTAL': break;

                    case 'MESSAGE_CREATE':
                        discordController.callListeners('message_create', p.d);
                    break;

                    case 'MESSAGE_DELETE':
                    break;
                }
            break;
        }
    }

    async fetchMessages(channel: string, limit=50) {
        const j = await fetch(`${this.api}/channels/${channel}/messages?limit=${limit}`, {
            headers: {
                'Authorization': this.token
            }
        });

        return (await j.json()) as ChatMessage[];
    }
    
    getUserById(id: string) {
        for(let i=0;i<this.users.length;i++) {
            if(this.users[i].id == id) return this.users[i];
        }
    }

    getDMChannelByUserId(id: string) {
        for(const priv of this.privChannels) {
            if(priv.type != 1) continue;
            if(priv.recipient_ids[0] == id) return priv;
        }
    }

    getGuildById(id: string) {
        for(let i=0;i<this.guilds.length;i++) {
            if(this.guilds[i].id == id) return this.guilds[i];
        }
    }

    getGuilds() {
        return this.guilds;
    }

    getUsers() {
        console.clear();
        return this.users;
    }

    sendMessage(channel: string, content: string) {
        fetch(`${this.api}/channels/${channel}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                content,
                flags: 0,
                mobile_network_type: 'unknown',
                nonce: Math.floor(Math.random()*999999999),
                tts: false
            }),

            headers: {
                Authorization: this.token,
                'Content-Type': 'application/json'
            }
        });
    }
}

