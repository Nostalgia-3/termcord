import { Guild, User, ReadyPacket, ChatMessage, PrivateChannel, ChannelUpdate, PresenceUpdate } from "./types.ts";

enum DiscordPackets {
    // Client -> Server
    Heartbeat = 1,
    Identify = 2,

    // Server -> Client
    User = 0,
    InitHeartbeat = 10
}

type DiscordEvents = {
    'ready': [], 'resumed': [], 'auth_change': [], 'auth_create': [], 'auth_update': [], 'auth_delete': [], 'app_command_perm': [],
    'automod_rule_create': [], 'automod_rule_update': [], 'automod_rule_delete': [], 'automod_action': [], 'automod_raid_mention': [],
    'call_create': [], 'call_update': [], 'call_delete': [], 'channel_create': [], 'channel_update': [channel: ChannelUpdate], 'channel_delete': [],
    'channel_statuses': [], 'voice_channel_update': [], 'channel_pins_update': [], 'group_add_member': [], 'group_remove_member': [],
    'dm_settings_upsell': [], 'thread_create': [], 'thread_update': [], 'thread_delete': [], 'thread_list_sync': [], 'thread_member_update': [],
    'thread_members_update': [], 'suggestion_create': [], 'suggestion_delete': [], 'guild_create': [], 'guild_update': [], 'guild_delete': [],
    'guild_audit_create': [], 'guild_ban_add': [], 'guild_ban_remove': [], 'guild_emojis_update': [], 'guild_stickers_update': [],
    'guild_join_req_create': [], 'guild_join_req_update': [], 'guild_join_req_delete': [], 'guild_member_add': [], 'guild_member_remove': [],
    'guild_member_update': [], 'guild_members_chunk': [], 'guild_role_create': [], 'guild_role_update': [], 'guild_role_delete': [],
    'guild_s_ev_create': [], 'guild_s_ev_update': [], 'guild_s_ev_delete': [], 'guild_s_ev_add_user': [], 'guild_s_ev_rem_user': [],
    'guild_audio_create': [], 'guild_audio_update': [], 'guild_audio_delete': [], 'soundboard_sounds': [],
    'integrations_update': [], 'integration_create': [], 'integration_update': [], 'integration_delete': [], 'interaction_create': [],
    'invite_create': [], 'invite_delete': [], 'message_create': [message: ChatMessage], 'message_update': [], 'message_delete': [message: ChatMessage],
    'message_delete_bulk': [], 'message_poll_add': [], 'message_poll_remove': [], 'message_react_add': [], 'message_react_add_m': [],
    'message_react_rem': [], 'message_react_rem_all': [], 'message_react_rem_emo': [], 'recent_mention_delete': [], 'last_messages': [],
    'oauth2_token_revoke': [], 'presence_update': [presence: PresenceUpdate], 'relationship_add': [], 'relationship_update': [], 'relationship_remove': [],
    'stage_instance_create': [], 'stage_instance_update': [], 'stage_instance_delete': [], 'typing_start': [], 'user_update': [], 'user_app_remove': [],
    'user_conn_update': [], 'user_note_update': [], 'user_req_action_update': [], 'voice_state_update': [], 'voice_server_update': [],
    'voice_channel_effect_send': [], 'webhooks_update': [],
};

class TypedEventEmitter<TEvents extends Record<string, any>> {
    listeners: { name: string, cb: (...eventArg: TEvents[string]) => void, once: boolean }[];

    constructor() {
        this.listeners = [];
    }

    emit<TEventName extends keyof TEvents & string>(eventName: TEventName, ...eventArg: TEvents[TEventName]) {
        for(let i=0;i<this.listeners.length;i++) {
            if(this.listeners[i].name == eventName) {
                this.listeners[i].cb(...eventArg);
                if(this.listeners[i].once) this.listeners.splice(i, 1);
            }
        }
    }

    on<TEventName extends keyof TEvents & string>(eventName: TEventName, handler: (...eventArg: TEvents[TEventName]) => void) {
        this.listeners.push({ name: eventName as string, cb: handler as ((...eventArg: TEvents[string]) => void), once: false });
    }

    once<TEventName extends keyof TEvents & string>(eventName: TEventName, handler: (...eventArg: TEvents[TEventName]) => void) {
        this.listeners.push({ name: eventName as string, cb: handler as ((...eventArg: TEvents[string]) => void), once: true });
    }
}

export class DiscordController extends TypedEventEmitter<DiscordEvents> {
    api = 'https://discord.com/api/v9';

    token: string;
    ws: WebSocket;

    heartbeat_int: number;

    guilds: Guild[];
    users: User[];
    privChannels: PrivateChannel[];

    logHandler: (_msg: string) => void;

    constructor(logHandler = (_msg: string) => { }) {
        super();

        this.token = '';

        // just connect to a random ws server because i dont want to deal with (WebSocket | undefined)
        this.ws = new WebSocket('https://echo.websocket.org/');

        this.heartbeat_int = -1;

        this.logHandler = logHandler;

        this.guilds = [];
        this.privChannels = [];
        this.users = [];
    }

    connect(token: string) {
        this.token = token;

        this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

        this.ws.onopen = (ev) => {
            this.onOpen(ev);
        };
        this.ws.onmessage = (ev) => {
            this.onMessage(ev);
        };
    }

    protected onOpen(_ev: Event) {
        this.logHandler(`WebSocket opened`);
    }

    // deno-lint-ignore no-explicit-any
    onMessage(ev: MessageEvent<any>) {
        const p: { t: unknown | null, s: unknown | null, op: number, d: Record<string, unknown> } = JSON.parse(ev.data);

        this.logHandler(`Packet with op=${p.op} t=${p.t} s=${p.s}`);

        switch (p.op) {
            case DiscordPackets.InitHeartbeat: {
                const data = p.d as { heartbeat_interval: number, _trace: string[] };

                this.heartbeat_int = setInterval((ws: WebSocket) => {
                    ws.send(JSON.stringify({ op: DiscordPackets.Heartbeat, d: 3 }));
                }, data.heartbeat_interval, this.ws);

                this.ws.send(JSON.stringify({
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
                        token: this.token
                    }
                }));
                break;
            }

            case DiscordPackets.User:
                switch (p.t) {
                    case 'READY': {
                        const data = p.d as ReadyPacket;

                        this.guilds = data.guilds;
                        this.users = Array.from(data.users);
                        this.privChannels = data.private_channels;

                        this.emit('ready');
                        break;
                    }

                    case 'READY_SUPPLEMENTAL': break;

                    case 'MESSAGE_CREATE': this.emit('message_create',      p.d as ChatMessage); break;
                    case 'MESSAGE_DELETE': this.emit('message_delete',      p.d as ChatMessage); break;
                    case 'PRESENCE_UPDATE': this.emit('presence_update',    p.d as PresenceUpdate); break;
                    case 'CHANNEL_UPDATE': this.emit('channel_update',      p.d as ChannelUpdate); break;
                }
                break;
        }
    }

    async fetchMessages(channel: string, limit = 50) {
        const j = await fetch(`${this.api}/channels/${channel}/messages?limit=${limit}`, {
            headers: {
                'Authorization': this.token
            }
        });

        return (await j.json()) as ChatMessage[];
    }

    getUserById(id: string) {
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].id == id) return this.users[i];
        }
    }

    getDMChannelByUserId(id: string) {
        for (const priv of this.privChannels) {
            if (priv.type != 1) continue;
            if (priv.recipient_ids[0] == id) return priv;
        }
    }

    getGuildById(id: string) {
        for (let i = 0; i < this.guilds.length; i++) {
            if (this.guilds[i].id == id) return this.guilds[i];
        }
    }

    getGuilds() {
        return this.guilds;
    }

    getUsers() {
        return this.users;
    }

    getPrivateChannels() {
        return this.privChannels;
    }

    sendMessage(channel: string, content: string) {
        fetch(`${this.api}/channels/${channel}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                content,
                flags: 0,
                mobile_network_type: 'unknown',
                nonce: Math.floor(Math.random() * 999999999),
                tts: false
            }),

            headers: {
                Authorization: this.token,
                'Content-Type': 'application/json'
            }
        });
    }

    setChannelName(channel: string, name: string) {
        return fetch(`${this.api}/channels/${channel}`, {
            method: 'PATCH',
            body: JSON.stringify({
                name
            }),
            headers: {
                Authorization: this.token,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
            }
        });
    }
}

