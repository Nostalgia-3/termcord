// deno-lint-ignore-file no-unused-vars ban-unused-ignore

import { ColorPanel, PlainText, ScrollableList, TermControls, Component, TextPanel } from "../src/ui.ts";
import { existsSync } from 'https://deno.land/std@0.224.0/fs/mod.ts';

import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";
import { Guild, ReadyPacket } from "./types.ts";

type Node = {
    com: Component,
    f:()=>{x: number, y: number, w: number, h: number}

    id: string,
};

type NodeGroup = {
    id: string,
    nodes: Node[],
    visible: boolean,
    zIndex: number
};

type Mode = 'normal' | 'write' | 'search' | 'command';

enum DiscordPackets {
    // Client -> Server
    Heartbeat = 1,
    Identify = 2,

    // Server -> Client
    User = 0,
    InitHeartbeat = 10,
}

class DiscordController {
    api = 'https://discord.com/api/v9';

    token: string;
    ws: WebSocket;

    heartbeat_int: number;

    guilds: Guild[];

    listeners: { ev: 'loaded', cb: () => void }[];

    constructor() {
        this.token = '';
        // just connect to a random ws server because i dont want to deal with (WebSocket | undefined)
        this.ws = new WebSocket('https://echo.websocket.org/');

        this.heartbeat_int = -1;

        this.guilds = [];
        this.listeners = [];
    }

    addListener(ev: 'loaded', cb: () => void) {
        this.listeners.push({ ev, cb });
    }

    callListeners(ev: 'loaded') {
        for(let i=0;i<this.listeners.length;i++) {
            if(this.listeners[i].ev == ev) this.listeners[i].cb();
        }
    }

    connect(token: string) {
        this.token = token;

        this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
    }

    onOpen(this: WebSocket, ev: Event) {
        console.log(`open`);
    }

    // deno-lint-ignore no-explicit-any
    onMessage(this: WebSocket, ev: MessageEvent<any>) {
        const p: { t: unknown | null, s: unknown | null, op: number, d: Record<string, unknown> } = JSON.parse(ev.data);

        console.log(p.op, p.t, p.s);

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

                        discordController.callListeners('loaded');
                    break; }

                    case 'READY_SUPPLEMENTAL': break;
                }
            break;
        }
    }

    getGuilds() {
        return this.guilds;
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

class App {
    uiGroups: NodeGroup[];
    size: { w: number, h: number };
    mode: Mode;
    home: string;

    secrets: { token: string };

    searchList: {name: string, action: (app: App) => void}[];

    message_string: string;
    command_string: string;
    search_string: string;

    disableDrawing: boolean;

    // translations for names and such
    t = {
        name: 'Termcord',
        p_message_text: 'Message Channel',
        p_search_text: 'Search Here...'
    };

    theme = {
        // channel bar
        channels_bg:        [43, 45, 49],
        channel_sel_fg:     [249, 255, 255],
        channel_sel_bg:     [53, 55, 60],

        server_name_bg:     [46, 50, 56],

        // command bar
        command_bg:         [38, 40, 44],

        // list of messages
        messages_bg:        [49, 51, 56],
        // selected message
        message_sel_fg:     [255, 255, 255],
        message_sel_bg:     [46, 48, 53],

        // input message bar
        message_bar_fg:     [255, 255, 255],

        // Ctrl+K search menu
        search_inp_bg:      [30, 31, 34],
        search_bg:          [43, 45, 49],

        // text in general
        text_normal:        [255, 255, 255],
        text_placeholder:   [127, 127, 127],
        text_inp_bg:        [56, 58, 64],

        // generic colors
        g_black:            [0, 0, 0],
        g_red:              [0, 0, 0],
        g_green:            [0, 0, 0],
        g_yellow:           [0, 0, 0],
        g_blue:             [88, 101, 242],
        g_magenta:          [0, 0, 0],
        g_cyan:             [0, 0, 0],
        g_white:            [0, 0, 0]
    };

    constructor() {
        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };

        this.uiGroups = [];
        this.searchList = [];

        this.disableDrawing = false;

        this.message_string = '';
        this.search_string  = '';
        this.command_string = '';

        this.secrets = { token: '<NOT LOADED>' };

        this.mode = 'normal';
        this.home = '';

        // load theme

        // generic background for everything
        this.uiGroups.push({
            id: 'generic_background',
            nodes: [
                { com: new ColorPanel({ bg: this.theme.messages_bg }), f:()=>({x: 0, y: 0, w: this.size.w, h: this.size.h}), id: 'back' }
            ],
            visible: true,
            zIndex: 0
        });

        // ui for servers (e.g. channels)
        this.uiGroups.push({
            id: 'chat_server',
            nodes: [
                {
                    com: new ColorPanel({ bg:this.theme.messages_bg }),
                    f:()=>({x:0,y:0,w:this.size.w,h:this.size.h}),
                    id:'background'
                },
                {
                    com: new ScrollableList({ bg_no_item:this.theme.messages_bg }),
                    f:()=>({x: 25, y: 1, w: this.size.w-25, h: this.size.h-1-3}),
                    id: 'messages'
                },
                {
                    com: new ScrollableList({ bg_no_item:this.theme.channels_bg }),
                    f:()=>({x: 0, y: 0, w: 25, h: this.size.h}),
                    id: 'channels'
                },
                {
                    com: new ColorPanel({ bg:this.theme.command_bg }),
                    f:()=>({x: 25, y: 0, w: this.size.w-25, h: 1}),
                    id: 'titlebar_back'
                },
                {
                    com: new PlainText('Command here', { bg:this.theme.command_bg }),
                    f:()=>({x: 25+1, y: 0, w: this.size.w-25, h: 1}),
                    id: 'command'
                },
                {
                    com: new PlainText(' Server Name'.padEnd(25), {bg:this.theme.server_name_bg}),
                    f: ()=>({x: 0, y: 0, w: 25, h: 1}),
                    id: 'server_name'
                },
                {
                    com: new TextPanel(' Message #channel-name', {fg:this.theme.text_placeholder,bg:this.theme.text_inp_bg,alignY:'center',corner:'3thin',cbg:this.theme.messages_bg }),
                    f:()=>({x:26,y:this.size.h-3,w:this.size.w-26-1,h:3}),
                    id:'message'
                },
                {
                    com: new PlainText('[N]', {bg:this.theme.command_bg,fg:this.theme.g_blue}),
                    f:()=>({x: this.size.w-5, y: 0, w: 5, h: 1,}),
                    id: 'mode'
                },
            ],
            visible: true,
            zIndex: 5
        });

        // search modal
        this.uiGroups.push({
            id: 'search',
            nodes: [
                {
                    com: new ColorPanel({ bg: this.theme.search_bg }),
                    f: ()=>({x: Math.floor((this.size.w-60)/2), y: Math.floor((this.size.h-15)/2), w: 60, h: 15,}),
                    id:'search_bg'
                },
                {
                    com: new TextPanel(' Search here...',{bg:this.theme.search_inp_bg,fg:[128,128,128],alignX:'left',alignY:'center',corner:'3thin',cbg:this.theme.search_bg}),
                    f: ()=>({x: Math.floor((this.size.w-56)/2), y: Math.floor((this.size.h-15)/2)+1, w: 56, h: 3}),
                    id: 'textPanel'
                }
            ],
            visible: true,
            zIndex: 10
        });

        // Debug logger
        this.uiGroups.push({
            id: 'debug-logger',
            nodes: [
                {
                    com: new TextPanel('Debug Logger', { alignX: 'left', alignY: 'top', bg: [50, 40, 40], fg: [255, 255, 255] }),
                    f: () => ({ x: 1, y: 1, w: this.size.w-2, h: 1 }),
                    id: 'debug-title'
                },
                {
                    com: new ScrollableList({ bg: [40, 30, 30], fg: [255, 255, 255], bg_no_item: [40, 30, 30], bg_selected: [40,30,30], fg_selected:[255,255,255], text_align: 'left' }),
                    f: () => ({ x: 1, y: 2, w: this.size.w-2, h: this.size.h-3 }),
                    id: 'debug'
                }
            ],
            visible: false,
            zIndex: 1000
        });
    }

    debugLog(msg: string) {
        const debugGroup = this.getGroupByID('debug-logger') as NodeGroup;
        const scrollableList = this.getNodeByID(debugGroup, 'debug') as Node;

        (scrollableList.com as ScrollableList).addItem(msg);
    }

    async start() {
        await this.setupDirectory();

        this.draw();

        setInterval(this.update,1000/15, this);

        for await(const keypress of readKeypress(Deno.stdin)) {
            this.handleKeypress(keypress);
        }
    }

    async setupDirectory() {
        if(Deno.build.os == 'windows') {
            // @TODO implement this !!
            this.home = Deno.env.get('AppData') as string;

            
        } else if(Deno.build.os == 'linux') {
            this.home = Deno.env.get('HOME') as string;
        }

        if(!existsSync(this.home + '/.termcord')) {
            Deno.mkdirSync(this.home + '/.termcord');
            Deno.writeTextFileSync(`${this.home}/.termcord/secrets.json`, JSON.stringify({token: "<PUT YOUR TOKEN HERE>"}));
            Deno.writeTextFileSync(`${this.home}/.termcord/config.json`, JSON.stringify({ theme: 'discord' }));
        }

        if(!existsSync(this.home + '/.termcord/themes')) {
            Deno.mkdirSync(this.home + '/.termcord/themes');
        }

        // Download discord.json <3 (make this customizable)
        // Deno.writeTextFileSync(`${this.home}/.termcord/themes/discord.json`, await (await fetch('https://raw.githubusercontent.com/Nostalgia-3/termcord/main/themes/discord.json')).text());

        this.secrets = JSON.parse(Deno.readTextFileSync(`${this.home}/.termcord/secrets.json`));
        const config: Record<string, unknown> = JSON.parse(Deno.readTextFileSync(`${this.home}/.termcord/config.json`));

        if(!config.theme || !existsSync(`${this.home}/.termcord/themes/${config.theme}.json`)) {
            // Give an error in the log that the internal theme doesn't exist and change it to the default theme
            this.debugLog(`[ERR] couldn't find theme "${config.theme}" -- replacing with discord`);
            config.theme = `discord`;
        }

        const theme = JSON.parse(Deno.readTextFileSync(`${this.home}/.termcord/themes/${config.theme}.json`));
        this.debugLog(`does theme "${config.theme}" exist: ${existsSync(`${this.home}/.termcord/themes/${config.theme}.json`)}`);
        this.theme = theme;
    }

    update(app: App) {
        const cs = Deno.consoleSize();
        if(app.size.w != cs.columns || app.size.h != cs.rows) {
            app.draw();
        }
    }

    handleKeypress(keypress: Keypress) {
        if(keypress.ctrlKey && keypress.key == 'c') {
            Deno.exit();
        }

        if(keypress.key == 'f3') {
            const dg = this.getGroupByID('debug-logger') as NodeGroup;
            dg.visible = !dg.visible;            
        }

        switch(this.mode) {
            case "normal":
                switch(keypress.key) {
                    case 'i': this.mode = 'write'; break;
                    case 'k': this.mode = 'search'; break;
                    case ':': this.mode = 'command'; this.command_string = ':'; break;
                }
            break;

            case 'write':
                switch(keypress.key) { 
                    case 'escape': this.mode = 'normal'; break;
                    case 'space': this.message_string+=' '; break;
                    case 'backspace': this.message_string = this.message_string.slice(0,this.message_string.length-1); break;

                    default: this.message_string+=keypress.key; break;
                }
            break;

            case 'command':
                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.command_string = ''; break;
                    case 'space': this.command_string+=' '; break;
                    case 'backspace': this.command_string = this.command_string.slice(0,this.command_string.length-1); break;
                    case 'return': this.parseCommand(this.command_string); this.command_string = ''; this.mode = 'normal'; break;

                    default: this.command_string+=keypress.key; break;
                }
            break;

            case 'search':
                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.search_string = ''; break;
                    case 'space': this.search_string+=' '; break;
                    case 'backspace': this.search_string = this.search_string.slice(0,this.search_string.length-1); break;
                    case 'return': this.mode='normal'; this.search_string = ''; break;

                    default: this.search_string+=keypress.key; break;
                }
            break;
        }

        this.draw();
    }

    draw() {
        if(this.disableDrawing) return;

        console.clear();

        this.uiGroups.sort((a,b)=>a.zIndex-b.zIndex);

        const cs = Deno.consoleSize();
        this.size = { w: cs.columns, h: cs.rows };

        const serverChat = this.getGroupByID('chat_server');
        if(!serverChat) Deno.exit(1);

        const search = this.getGroupByID('search');
        if(!search) Deno.exit(1);
        
        const messageBar    = this.getNodeByID(serverChat, 'message')?.com  as TextPanel;
        const commandBar    = this.getNodeByID(serverChat, 'command')?.com  as TextPanel;
        const modeText      = this.getNodeByID(serverChat, 'mode')?.com     as PlainText;
        const searchText    = this.getNodeByID(search, 'textPanel')?.com    as PlainText;

        if(this.message_string != '') { messageBar.setContent(' ' + this.message_string); messageBar.style.fg = [255,255,255]; }
        else { messageBar.setContent(` ${this.t.p_message_text}`); messageBar.style.fg = [128,128,128]; }

        if(this.command_string != '') { commandBar.setContent(this.command_string); commandBar.style.fg = [255,255,255]; }
        else { commandBar.setContent(` `); commandBar.style.fg = [128,128,128]; }

        if(this.search_string != '') { searchText.setContent(' ' + this.search_string); searchText.style.fg = [255,255,255]; }
        else { searchText.setContent(` ${this.t.p_search_text}`); searchText.style.fg = [128,128,128]; }

        switch(this.mode) {
            case 'normal':  modeText.setContent('[N]'); search.visible=false; break;
            case 'write':   modeText.setContent('[W]'); search.visible=false; break;
            case 'command': modeText.setContent('[C]'); search.visible=false; break;
            case 'search':  modeText.setContent('[S]'); search.visible=true; break;
        }

        for(let i=0;i<this.uiGroups.length;i++) {
            if(!this.uiGroups[i].visible) continue;

            
            for(let x=0;x<this.uiGroups[i].nodes.length;x++) {
                const comp = this.uiGroups[i].nodes[x];

                const c = comp.f();

                comp.com.draw(c.x, c.y, c.w, c.h);
            }
        }

        switch(this.mode) {
            case 'normal': TermControls.goTo(0, 0); break;
            case 'write': TermControls.goTo(27+this.message_string.length, this.size.h-2);  break;
            case 'command': TermControls.goTo(26+this.command_string.length, 0); break;
            case 'search': { TermControls.goTo(Math.floor((this.size.w-56)/2)+1+this.search_string.length, Math.floor((this.size.h-15)/2)+2); break; }
        }
    }

    /**
     * Begin connecting to the Discord servers
     */
    connect() {
        if(this.secrets.token == `<PUT YOUR TOKEN HERE>` || this.secrets.token == `<NOT LOADED>`) {
            console.clear();
            console.error(`You need to put your token in secrets.json!`);
            Deno.exit(1);
        }

        console.clear();
        // this.disableDrawing = true;

        discordController.addListener('loaded', () => {
            for(const guild of discordController.getGuilds()) {
                // put guilds in fuzzy search for (ctrl+)k menu
            }
        });

        discordController.connect(this.secrets.token);
    }

    parseCommand(s: string) {
        const secs = s.split(' ');

        switch(secs[0]) {
            case ':q': console.clear(); Deno.exit(0); break;
            case ':h': break;

            case ':theme':
                if(secs[1]) {
                    if(existsSync(`${this.home}/.termcord/themes/${secs[1]}.json`)) {
                        const config: Record<string, unknown> = JSON.parse(Deno.readTextFileSync(`${this.home}/.termcord/config.json`));
                        config.theme = secs[1];
                        Deno.writeTextFileSync(`${this.home}/.termcord/config.json`, JSON.stringify(config));
                    }
                }
            break;

            case ':connect':
                this.connect();
            break;
        }
    }

    getGroupByID(id: string) {
        for(let i=0;i<this.uiGroups.length;i++) {
            if(this.uiGroups[i].id == id) return this.uiGroups[i];
        }
    }

    getNodeByID(group: NodeGroup, id: string) {
        for(let i=0;i<group.nodes.length;i++) {
            if(group.nodes[i].id == id) return group.nodes[i];
        }
    }
}

const discordController = new DiscordController();
const app = new App();

app.start();