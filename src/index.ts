// deno-lint-ignore-file no-unused-vars ban-unused-ignore

import { ColorPanel, PlainText, ScrollableList, TermControls, Component, TextPanel, clearStyleString } from "../src/ui.ts";
import { existsSync } from 'https://deno.land/std@0.224.0/fs/mod.ts';

import Fuse from 'https://deno.land/x/fuse@v6.4.0/dist/fuse.esm.min.js'
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

type Mode = 'normal' | 'write' | 'search' | 'command' | 'scroll_messages';

enum DiscordPackets {
    // Client -> Server
    Heartbeat = 1,
    Identify = 2,

    // Server -> Client
    User = 0,
    InitHeartbeat = 10
}

enum SearchMenuType {
    Channel     = '$F_CYANC$RESET',
    Server      = '$F_BLUES$RESET',
    Category    = '$F_REDC$RESET'
};

function putStrIn(s: string, put: string, x: number) {
    const left = s.substring(0, x);
    const right = s.substring(x);
    
    return left + put + right;
}

function removeChar(s: string, num: number, x: number) {
    const left = s.substring(0, x-num);
    const right = s.substring(x);

    return left + right;
}

function clamp(num: number, min: number, max: number) {
    if(num > max) return max;
    if(num < min) return min;
    return num;
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
            app.debugLog(`calling ${this.listeners[i].ev}[${i}]`);
        }
    }

    connect(token: string) {
        this.token = token;

        this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

        this.ws.onopen = this.onOpen;
        this.ws.onmessage = this.onMessage;
    }

    onOpen(this: WebSocket, ev: Event) {
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
    fuse: Fuse;

    static version = '0.1.0';

    secrets: { token: string };

    search_mode: 'typing' | 'viewing';

    searchList: {name: string, type: string, action: (app: App) => void}[];

    message_string: string;
    com_string: string;
    search_string: string;
    
    mes_cur_x: number;
    search_cur_x: number;
    com_cursor_x: number;

    disableDrawing: boolean;

    currentChannel: string;
    currentServer?: { name: string, id: string, g: Guild };

    results: { item: {name:string,type:string,action:(app:App)=>void}, refIndex: unknown }[];

    // translations for names and such
    t = {
        name: 'Termcord',
        p_message_text: 'Message #channel',
        p_search_text: 'Search Here...',
        welcome_msg: `Termcord v${App.version}`
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
        text_placeholder:   [12, 12, 12],
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

        this.search_mode = 'typing';

        this.mes_cur_x    = 0;
        this.search_cur_x = 0;
        this.com_cursor_x = 0;

        this.disableDrawing = false;

        this.message_string = '';
        this.search_string  = '';
        this.com_string = '';

        this.secrets = { token: '<NOT LOADED>' };

        this.currentChannel = 'NOT CONNECTED';

        this.mode = 'normal';
        this.home = '';

        this.results = [];

        this.fuse = new Fuse(this.searchList, { keys: [ 'name' ] });

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

    selectChannel(guild: string, channel: string) {
        this.debugLog(`Selecting channel | Guild ID = ${guild} | Channel ID = ${channel}`);
    }

    selectGuild(id: string) {
        const guilds = discordController.getGuilds();

        const g = guilds.find((v)=>v.id==id);

        if(!g || !g.properties.name) {
            this.writeSystemMessage(`ERROR: unknown server with ID "${id}"!`);
            return;
        }

        this.debugLog(`Selecting guild with ID ${id} (${g.properties.name})`);

        this.currentServer = { name: g.properties.name, id, g };
    }

    sendMessage(channelID: string, content: string, time?: string) {
        if(channelID == `NOT CONNECTED`) {
            this.writeSystemMessage(`$F_REDError:$RESET Cannot send $F_WHITE"${clearStyleString(content)}"$RESET while not connected!`, time);
        } else if(channelID == ``) {
            this.writeSystemMessage(`$F_REDError:$RESET Cannot send $F_WHITE"${clearStyleString(content)}"$RESET while not in a channel!`, time);
        }
    }

    writeSystemMessage(msg: string, time?: string) {
        this.writeToMessages(`$F_BLUE<SYSTEM>$RESET ${msg}`, time);
    }

    writeToMessages(msg: string, time?: string) {
        const chatForServer = this.getGroupByID('chat_server') as NodeGroup;
        const messages = this.getNodeByID(chatForServer, 'messages') as Node;

        (messages.com as ScrollableList).addItem(`${ time ?? this.formatTime(new Date()) } ${msg}`);
    }

    formatTime(t: Date) {
        const h = (t.getHours() > 12) ? t.getHours()-12 : t.getHours();
        const m = t.getMinutes().toString().padStart(2, '0');
        
        const ampm = (t.getHours() >= 12) ? 'PM' : 'AM';

        return `${h}:${m} ${ampm}`;
    }

    debugLog(msg: string) {
        const debugGroup = this.getGroupByID('debug-logger') as NodeGroup;
        const scrollableList = this.getNodeByID(debugGroup, 'debug') as Node;

        (scrollableList.com as ScrollableList).addItem(msg);
    }

    async start() {
        await this.setupDirectory();

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
                    com: new ScrollableList({
                        bg_no_item:this.theme.messages_bg, bg_selected: this.theme.message_sel_bg, fg_selected: this.theme.message_sel_fg, text_align: 'left',
                        bg: this.theme.messages_bg, fg: this.theme.text_normal, marginLeft: 1, marginRight: 0
                    }),
                    f:()=>({x: 0, y: 1, w: this.size.w, h: this.size.h-4}),
                    id: 'messages'
                },
                {
                    com: new TextPanel('Command here', { bg:this.theme.command_bg, alignX: 'left', alignY: 'top' }),
                    f:()=>({x: 0, y: 0, w: this.size.w, h: 1}),
                    id: 'command'
                },
                {
                    com: new TextPanel(' Message #channel-name', {fg:this.theme.text_placeholder,bg:this.theme.text_inp_bg,alignY:'center',corner:'3thin',cbg:this.theme.messages_bg }),
                    f:()=>({x:5,y:this.size.h-3,w:this.size.w-1-10,h:3}),
                    id:'message'
                },
                {
                    com: new TextPanel('', {bg:this.theme.command_bg,fg:this.theme.text_normal,alignX:'right',alignY:'top'}),
                    f:()=>({x: this.size.w-20, y: 0, w: 20, h: 1,}),
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
                    f: ()=>({x: Math.floor((this.size.w-60)/2), y: Math.floor((this.size.h-15)/2), w: 60, h: 15}),
                    id:'search_bg'
                },
                {
                    com: new TextPanel(' Search here...',{bg:this.theme.search_inp_bg,fg:[128,128,128],alignX:'left',alignY:'center',corner:'3thin',cbg:this.theme.search_bg}),
                    f: ()=>({x: Math.floor((this.size.w-56)/2), y: Math.floor((this.size.h-15)/2)+1, w: 56, h: 3}),
                    id: 'textPanel'
                },
                {
                    com: new ScrollableList({ bg: this.theme.command_bg, bg_no_item: this.theme.command_bg, fg:[255,255,255], fg_selected:[0,0,0], text_align: 'left' }),
                    f: ()=>({x: Math.floor((this.size.w-56)/2)-1,y:Math.floor((this.size.h-15)/2)+1+3,w:58,h:10}),
                    id: 'searchItems'
                }
            ],
            visible: true,
            zIndex: 10
        });

        this.writeSystemMessage(`$BOLD$UNDERLINEHello!$RESET Currently you are not connected. To connect, type $ITALICS:connect$RESET!`);

        this.draw();

        setInterval(this.update,1000/15, this);

        for await(const keypress of readKeypress(Deno.stdin)) this.handleKeypress(keypress);
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
        }

        if(!existsSync(`${this.home}/.termcord/config.json`))
            Deno.writeTextFileSync(`${this.home}/.termcord/config.json`, JSON.stringify({ theme: 'discord' }));

        if(!existsSync(`${this.home}/.termcord/secrets.json`))
            Deno.writeTextFileSync(`${this.home}/.termcord/secrets.json`, JSON.stringify({token: "<PUT YOUR TOKEN HERE>"}));

        if(!existsSync(this.home + '/.termcord/themes'))
            Deno.mkdirSync(this.home + '/.termcord/themes');

        // Download discord.json <3 (make this customizable)
        if(!existsSync(this.home+'/.termcord/themes/discord.json'))
            Deno.writeTextFileSync(`${this.home}/.termcord/themes/discord.json`, await (await fetch('https://raw.githubusercontent.com/Nostalgia-3/termcord/main/themes/discord.json')).text());

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
            console.clear();
            Deno.exit(0);
        }

        if(keypress.key == 'f3') {
            const dg = this.getGroupByID('debug-logger') as NodeGroup;
            dg.visible = !dg.visible;
            this.draw(); 
        }

        const searchModal = this.getGroupByID('search') as NodeGroup;
        const searchText  = this.getNodeByID(searchModal, 'textInput');
        const searchList  = this.getNodeByID(searchModal, 'searchItems');
        
        if(keypress.key?.startsWith('f') && keypress.key.length > 1) return;

        switch(this.mode) {
            case "normal":
                switch(keypress.key) {
                    case 'i': this.mode = 'write'; break;
                    case 'k': this.mode = 'search'; break;
                    case ':': this.mode = 'command'; this.com_string = ':'; break;

                    default: TermControls.bell(); break;
                }
            break;

            case 'write':
                switch(keypress.key) { 
                    case 'escape': this.mode = 'normal'; break;
                    case 'space': this.message_string=putStrIn(this.message_string, ' ', this.mes_cur_x); this.mes_cur_x++; break;
                    case 'backspace': this.message_string = removeChar(this.message_string, 1, this.mes_cur_x); this.mes_cur_x=clamp(this.mes_cur_x-1,0,100); break;
                    case 'tab': this.message_string=putStrIn(this.message_string, '    ', this.mes_cur_x); this.mes_cur_x+=4; break;

                    case 'return':
                        this.sendMessage(this.currentChannel, this.message_string);
                        this.message_string = '';
                        this.mes_cur_x = 0;
                    break;

                    case 'left': this.mes_cur_x = clamp(this.mes_cur_x-1, 0, 1000); break;
                    case 'right': this.mes_cur_x = clamp(this.mes_cur_x+1, 0, this.message_string.length); break;

                    default:
                        if(!keypress.key || keypress.key.length > 1) break;
                        this.message_string=putStrIn(this.message_string, keypress.key as string, this.mes_cur_x);
                        this.mes_cur_x++;
                    break;
                }
            break;

            case 'command':
                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.com_string = ''; break;
                    case 'space': this.com_string=putStrIn(this.com_string, ' ', this.com_cursor_x); this.com_cursor_x++; break;
                    case 'backspace': if(this.com_string.length > 1) this.com_string = removeChar(this.com_string, 1, this.com_cursor_x); break;
                    case 'return': this.parseCommand(this.com_string); this.com_string = ''; this.mode = 'normal'; break;

                    default: this.com_string+=keypress.key; break;
                }
            break;

            case 'search': {
                const search = (searchList?.com as ScrollableList);

                let resetFuse = true;

                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.search_string = ''; this.search_cur_x = 0; break;
                    case 'space': this.search_string = putStrIn(this.search_string, ' ', this.search_cur_x); this.search_cur_x++; break;
                    case 'backspace': this.search_string = removeChar(this.search_string, 1, this.search_cur_x); this.search_cur_x--; break;
                    case 'return': {
                        const selectedItem = search.getSelectedIndex();

                        if(!this.results[selectedItem]) break;

                        this.results[selectedItem].item.action(this);

                        this.mode='normal'; this.search_string = '';  this.search_cur_x = 0;
                    break; }

                    case 'up':
                        (searchList?.com as ScrollableList).goUp();
                        resetFuse = false;
                    break;

                    case 'down':
                        (searchList?.com as ScrollableList).goDown();
                        resetFuse = false;
                    break;

                    case 'left': this.search_cur_x=clamp(this.search_cur_x-1,0,150); break;
                    case 'right': this.search_cur_x=clamp(this.search_cur_x+1,0,this.search_string.length); break;

                    default:
                        this.search_string = putStrIn(this.search_string, keypress.key as string, this.search_cur_x);
                        this.search_cur_x++;
                    break;
                }

                if(resetFuse) {
                    this.fuse = new Fuse(this.searchList, { keys: ['name'] });
    
                    search.clearItems();
                    this.results = this.fuse.search(this.search_string);

                    for(let i=0;i<this.results.length;i++) {
                        search.addItem(`[${this.results[i].item.type}] ${this.results[i].item.name}`);
                    }
                }
            break; }
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
        const searchList    = this.getNodeByID(search, 'searchItems')?.com  as ScrollableList;
        const messages      = this.getNodeByID(serverChat, 'messages')?.com as ScrollableList;
        
        if(this.message_string != '') { messageBar.setContent(' ' + this.message_string); messageBar.style.fg = [255,255,255]; }
        else { messageBar.setContent(` ${this.t.p_message_text}`); messageBar.style.fg = [128,128,128]; }

        if(this.com_string != '') { commandBar.setContent(this.com_string); commandBar.style.fg = [255,255,255]; }
        else { commandBar.setContent(` `); commandBar.style.fg = [128,128,128]; }

        if(this.search_string != '') { searchText.setContent(' ' + this.search_string); searchText.style.fg = [255,255,255]; }
        else { searchText.setContent(` ${this.t.p_search_text}`); searchText.style.fg = [128,128,128]; }

        if(this.mode != 'scroll_messages') messages.setIndex(9999999);

        switch(this.mode) {
            case 'normal':  modeText.setContent('$F_BLUE[N]$RESET '); search.visible=false; break;
            case 'write':   modeText.setContent('$F_BLUE[W]$RESET '); search.visible=false; break;
            case 'command': modeText.setContent('$F_BLUE[C]$RESET '); search.visible=false; break;
            case 'search':  modeText.setContent('$F_BLUE[S]$RESET '); search.visible=true; break;
        }

        if(this.currentServer) { modeText.setContent(`$F_CYAN$BOLD${this.currentServer.name.substring(0, 30)}$RESET $F_GRAY┃$RESET` + modeText.getContent()); }
        else { modeText.setContent(`$F_CYAN$BOLDNo Server$RESET $F_GRAY┃$RESET ` + modeText.getContent()); }

        if(this.currentChannel != 'NOT CONNECTED' && this.currentChannel != '') {
            modeText.setContent(`$F_GREEN$BOLD${this.currentChannel.substring(0, 30)}$RESET $F_GRAY┃$RESET ` + modeText.getContent());
        } else {
            modeText.setContent(`$F_GREEN$BOLDNo Channel$RESET $F_GRAY┃$RESET ` + modeText.getContent());
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
            case 'write': TermControls.goTo(this.mes_cur_x+6, this.size.h-2);  break;
            case 'command': TermControls.goTo(this.com_string.length, 0); break;
            case 'search': {
                if(this.search_mode == 'typing') {
                    TermControls.goTo(Math.floor((this.size.w-56)/2)+1+this.search_cur_x, Math.floor((this.size.h-15)/2)+2);
                } else if(this.search_mode == 'viewing') {
                    TermControls.goTo(Math.floor((this.size.w-56)/2)-1,Math.floor((this.size.h-15)/2)+4+searchList.getSelectedIndex());
                }
            break; }
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

        this.writeSystemMessage(`Connecting to Discord...`);

        console.clear();

        discordController.addListener('loaded', () => {
            this.writeSystemMessage(`Connected to Discord!`);
            for(const guild of discordController.getGuilds()) {
                // put guilds in fuzzy search for (ctrl+)k menu
                this.searchList.push({ name: guild.properties.name, type: SearchMenuType.Server, action:(app)=>{ app.selectGuild(guild.id) } });

                for(const channel of guild.channels) {
                    // put channels in fuzzy search
                    if(channel.type == 4) continue;
                    this.searchList.push({
                        name: channel.name,
                        type: SearchMenuType.Channel,
                        action: (app) => { app.selectChannel(guild.id, channel.id) }
                    })
                }
            }
            this.draw();
        });

        discordController.connect(this.secrets.token);
    }

    parseCommand(s: string) {
        const secs = s.split(' ');

        switch(secs[0]) {
            case ':q': console.clear(); Deno.exit(0); break;

            case ':help':
            case ':h':
                this.writeToMessages(`$F_BLUE<SYSTEM>$RESET Commands:`);
                this.writeToMessages(` $F_CYAN-$RESET $F_GREEN:h$RESET, $F_GREEN:help$RESET      - Show this menu`);
                this.writeToMessages(` $F_CYAN-$RESET $F_GREEN:theme$RESET $F_YELLOW<theme>$RESET - Set theme to $F_YELLOW<theme>$RESET`);
                this.writeToMessages(` $F_CYAN-$RESET $F_GREEN:connect$RESET       - Connect to Discord's servers`);
                this.writeToMessages(` $F_CYAN-$RESET $F_GREEN:q$RESET             - Closes the app`);
            break;

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

            case '': break;

            default:
                this.writeToMessages(`$F_BLUE<SYSTEM>$RESET Unknown command: "$F_GREEN${secs[0]}$RESET"`);
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