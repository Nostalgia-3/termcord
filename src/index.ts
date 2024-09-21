// deno-lint-ignore-file no-unused-vars ban-unused-ignore

import { ColorPanel, PlainText, ScrollableList, TermControls, Component, TextPanel, clearStyleString, slice } from "../src/ui.ts";
import { existsSync } from 'https://deno.land/std@0.224.0/fs/mod.ts';

import Fuse from 'https://deno.land/x/fuse@v6.4.0/dist/fuse.esm.min.js'
import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";
import { ChatMessage, Guild, GuildChannel, PrivateChannel } from "./types.ts";
import { DiscordController } from "./discord.ts";

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

type CachedMessage = ChatMessage;

type Mode = 'normal' | 'write' | 'search' | 'command' | 'scroll_messages';

enum SearchMenuType {
    Channel     = '$F_CYANC$RESET',
    Server      = '$F_BLUES$RESET',
    Category    = '$F_REDC$RESET',
    User        = '$F_YELLOWU$RESET',
    Group       = '$F_REDG$RESET'
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

    activeChannel: string;

    // @TODO make this better (because I feel like this will lead to issues)
    currentChannel?: GuildChannel;
    currentServer?: { name: string, id: string, g: Guild };
    currentDM?: PrivateChannel;

    results: { item: {name:string,type:string,action:(app:App)=>void}, refIndex: unknown }[];

    messages: Map<string, CachedMessage[]>;

    t = {
        name: 'Termcord',
        p_message_text: 'Message #%CHANNEL_NAME%',
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

        this.activeChannel = '';

        this.mode = 'normal';
        this.home = '';

        this.messages = new Map();

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

    async selectChannel(guildID: string, channelID: string) {
        const g = discordController.getGuildById(guildID);
        if(!g) {
            console.clear();
            console.error(`Guild with ID "${guildID}" does not exist`);
            Deno.exit(1);
        }

        let channel: GuildChannel|undefined;

        for(let i=0;i<g.channels.length;i++) {
            if(g.channels[i].id == channelID) {
                channel = g.channels[i];
                break;
            }
        }

        if(!channel) {
            console.clear();
            this.debugLog(`ERROR: Channel does not exist`);
            Deno.exit(1);
        }

        this.currentServer = { name: g.properties.name, id: guildID, g };
        this.currentChannel = channel;
        this.currentDM = undefined;

        this.activeChannel = g.id;

        const text = this.getGroupByID('chat_server') as NodeGroup;
        const messages = (this.getNodeByID(text, 'messages') as Node).com as ScrollableList;
        messages.clearItems();

        if(this.messages.has(channelID)) {
            const msgs = this.messages.get(channelID) as CachedMessage[];

            for(const msg of msgs) {
                this.writeToMessages(`<${msg.author.global_name}>: ${msg.content}`);
            }
        } else {
            const msgs = (await discordController.fetchMessages(channelID)).reverse();
            
            const cachedMessages: CachedMessage[] = [];

            for(let i=0;i<msgs.length;i++) {
                cachedMessages.push(msgs[i]);
            }

            this.messages.set(channelID, cachedMessages);

            for(const msg of cachedMessages) {
                this.writeToMessages(`<${msg.author.global_name}>: ${msg.content}`, this.formatTime(new Date(msg.timestamp)));
            }

            this.draw();
        }

        this.debugLog(`Selecting channel | Guild ID = ${guildID} | Channel ID = ${channelID}`);
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

    async selectUser(id: string) {
        const user = discordController.getUserById(id);

        if(!user) {
            this.debugLog(`ERR: couldn't find user ${id}!!`);
            return;
        }

        this.debugLog(`Selecting user | Global Name = ${user.global_name} | ID = ${id}`);

        // hehehehehehhee
        this.currentServer = undefined;
        this.currentChannel = undefined;

        const d = discordController.getDMChannelByUserId(id);

        if(!d) {
            this.debugLog(`ERR: couldn't find DM channel from user ID ${id} (${user.username})`);
            return;
        }

        this.debugLog(`d.id = ${d?.id}`);

        this.currentDM = d;

        this.activeChannel = d.id;

        const text = this.getGroupByID('chat_server') as NodeGroup;
        const messages = (this.getNodeByID(text, 'messages') as Node).com as ScrollableList;
        messages.clearItems();

        if(this.messages.has(d.id)) {
            const msgs = this.messages.get(d.id) as CachedMessage[];

            for(const msg of msgs) {
                this.writeToMessages(`<${msg.author.global_name}>: ${msg.content}`);
            }
        } else {
            const msgs = (await discordController.fetchMessages(d.id)).reverse();
            
            const cachedMessages: CachedMessage[] = [];

            for(let i=0;i<msgs.length;i++) {
                cachedMessages.push(msgs[i]);
            }

            this.messages.set(d.id, cachedMessages);

            for(const msg of cachedMessages) {
                this.writeToMessages(`<${msg.author.global_name}>: ${msg.content}`, this.formatTime(new Date(msg.timestamp)));
            }

            this.draw();
        }
    }

    sendMessage(content: string, channel?: string, time?: string) {
        if(channel) {
            discordController.sendMessage(channel, content);
        } else if(this.currentDM) {
            this.debugLog(`sending DM message to ${this.currentDM.id}`);
            discordController.sendMessage(this.currentDM.id, content);
        } else {
            this.writeSystemMessage(`$F_REDError:$RESET Cannot send $F_WHITE"${clearStyleString(content)}"$RESET while not connected to a channel!`, time);
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

        // $ITALICS${t.getDate().toString().padStart(2,'0')}/${t.getMonth()}/${t.getFullYear()}$RESET 

        return `$BOLD${h}:${m} ${ampm}$RESET`;
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

        this.uiGroups.push({
            id: 'messages',
            nodes: [],
            visible: true,
            zIndex: 0
        })

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
                    case ':': this.mode = 'command'; this.com_string = ':'; this.com_cursor_x++; break;

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
                        this.sendMessage(this.message_string, this.currentChannel?.id);
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
                    case 'escape': this.mode = 'normal'; this.com_string = ''; this.com_cursor_x=0; break;
                    case 'space': this.com_string=putStrIn(this.com_string, ' ', this.com_cursor_x); this.com_cursor_x++; break;
                    case 'backspace': if(this.com_cursor_x > 1) this.com_string = removeChar(this.com_string, 1, this.com_cursor_x--); break;
                    case 'return': this.parseCommand(this.com_string); this.com_string = ''; this.mode = 'normal'; this.com_cursor_x=0; break;

                    default: this.com_string+=keypress.key; this.com_cursor_x++; break;
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
        else { messageBar.setContent(` ${this.t.p_message_text.replaceAll('%CHANNEL_NAME%', this.currentChannel?.name ?? 'unknown-channel')}`); messageBar.style.fg = [128,128,128]; }

        if(this.com_string != '') { commandBar.setContent(this.com_string); commandBar.style.fg = [255,255,255]; }
        else { commandBar.setContent(` `); commandBar.style.fg = [128,128,128]; }

        if(this.search_string != '') { searchText.setContent(' ' + this.search_string); searchText.style.fg = [255,255,255]; }
        else { searchText.setContent(` ${this.t.p_search_text}`); searchText.style.fg = [128,128,128]; }

        if(this.mode != 'scroll_messages') messages.style.draw_selected = false;

        switch(this.mode) {
            case 'normal':  modeText.setContent('$F_BLUE[N]$RESET '); search.visible=false; break;
            case 'write':   modeText.setContent('$F_BLUE[W]$RESET '); search.visible=false; break;
            case 'command': modeText.setContent('$F_BLUE[C]$RESET '); search.visible=false; break;
            case 'search':  modeText.setContent('$F_BLUE[S]$RESET '); search.visible=true; break;
        }

        if(this.currentServer) { modeText.setContent(`$F_CYAN$BOLD${this.currentServer.name.substring(0, 30)}$RESET $F_GRAY┃$RESET` + modeText.getContent()); }
        else { modeText.setContent(`$F_CYAN$BOLDNo Server$RESET $F_GRAY┃$RESET ` + modeText.getContent()); }

        if(!this.currentChannel) {
            modeText.setContent(`$F_GREEN$BOLDNo Channel$RESET $F_GRAY┃$RESET ${modeText.getContent()}`);
        } else {
            modeText.setContent(`$F_GREEN$BOLD${this.currentChannel.name}$RESET $F_GRAY┃$RESET ${modeText.getContent()}`);
        }

        if(!this.currentDM) {
            modeText.setContent(`$F_YELLOW$BOLDNo DM$RESET $F_GRAY┃$RESET ${modeText.getContent()}`);
        } else {
            modeText.setContent(`$F_YELLOW$BOLD${this.currentDM.id}$RESET $F_GRAY┃$RESET ${modeText.getContent()}`);
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
            case 'command': TermControls.goTo(this.com_cursor_x, 0); break;
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
     * Begin connecting to the Discord's servers
     */
    connect() {
        if(this.secrets.token == `<PUT YOUR TOKEN HERE>` || this.secrets.token == `<NOT LOADED>`) {
            console.clear();
            console.error(`You need to put your token in secrets.json!`);
            Deno.exit(1);
        }

        this.writeSystemMessage(`Connecting to Discord...`);

        console.clear();

        discordController.on('ready', () => {
            this.writeSystemMessage(`Connected to Discord!`);
            for(const guild of discordController.getGuilds()) {
                // put guilds in fuzzy search for (ctrl+)k menu
                this.searchList.push({ name: guild.properties.name, type: SearchMenuType.Server, action:(app)=>{ app.selectGuild(guild.id) } });

                for (const channel of guild.channels) {
                    // put channels in fuzzy search
                    this.searchList.push({
                        name: `${channel.name} ($UNDERLINE$BOLD$F_CYAN${guild.properties.name}$RESET)`,
                        type: SearchMenuType.Channel,
                        action: async(app) => { await app.selectChannel(guild.id, channel.id); }
                    });
                }
            }

            // put friends in fuzzy search
            for(const user of discordController.getUsers()) {
                this.searchList.push({
                    name: `${user.global_name ?? user.username}`,
                    type: SearchMenuType.User,
                    action: async(app) => { await app.selectUser(user.id); }
                })
            }

            for(const group of discordController.getPrivateChannels()) {
                if(group.type == 3) {
                    this.searchList.push({
                        name: `($UNDERLINE$BOLD$F_RED${group.id}$RESET)`,
                        type: SearchMenuType.Group,
                        action: (app) => { app.debugLog(`hello`); }
                    });
                }
                // if(group.type == 3) this.debugLog(`${group.id} | ${group.flags.toString(2)}`);
            }

            this.draw();
        });

        discordController.on('message_create', (data) => {
            this.debugLog(`message.id = ${data.channel_id} | this.activeChannel = ${this.activeChannel}`);

            if(data.channel_id == this.activeChannel) {
                this.writeToMessages(`<${data.author.global_name}>: ${data.content}`);
                this.draw();
            }

            // deal with adding the message to the message cache later

            TermControls.bell();
        });

        discordController.connect(this.secrets.token);
    }

    parseCommand(s: string) {
        const secs = s.trim().split(' ');

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

            case ':test':
                this.debugLog(slice('1234567890', 3).toString());
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


const app = new App();
const discordController = new DiscordController((s) => {
    app.debugLog(s);
});

app.start();