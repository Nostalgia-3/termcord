import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";

export class IndexedBuffer {
    protected buff: Uint8Array;
    protected ind: number;

    constructor(buffer: Uint8Array) {
        this.buff = buffer;
        this.ind = 0;
    }

    setIndex(n: number) {
        this.ind = n;
    }

    getBuffer() {
        return this.buff;
    }

    readBool(offset?: number) {
        return (this.readU8(offset) != 0) ? true : false;
    }

    readU8(offset?: number) {
        return (this.buff.at(offset ?? this.ind++) ?? -1);
    }

    readU16BE(offset?: number) {
        const b1 = this.readU8(offset ? offset     : this.ind++);
        const b2 = this.readU8(offset ? offset + 1 : this.ind++);

        return (b1 << 8) + b2;
    }

    readI32BE(offset?: number) {
        const b1 = this.readU8(offset ? offset     : this.ind++);
        const b2 = this.readU8(offset ? offset + 1 : this.ind++);
        const b3 = this.readU8(offset ? offset + 2 : this.ind++);
        const b4 = this.readU8(offset ? offset + 3 : this.ind++);

        return (b1 << 24) + (b2 << 16) + (b3 << 8) + b4;
    }

    readSection(amount: number, offset?: number) {
        return this.buff.slice(offset ?? (this.ind), offset ? offset + amount : (this.ind+=amount));
    }

    readShortString(offset?: number) {
        const decoder = new TextDecoder();
        const size = this.readU16BE(offset);
        const st = this.buff.slice(offset ?? this.ind, offset ?? (this.ind += size));

        return decoder.decode(st);
    }

    readString(offset?: number) {
        const decoder = new TextDecoder();
        const size = this.readVarInt(offset);
        const st = this.buff.slice(offset ?? this.ind, offset ?? (this.ind += size));

        return decoder.decode(st);
    }

    readVarInt(offset?: number) {
        const SEGMENT_BITS = 0x7F;
        const CONTINUE_BIT = 0x80;
    
        let value = 0;
        let position = 0;
        let currentByte = 0;
    
        while (true) {
            currentByte = this.readU8(offset);
            value |= (currentByte & SEGMENT_BITS) << position;
    
            if ((currentByte & CONTINUE_BIT) == 0) break;
    
            position += 7;
    
            if (position >= 32) throw new Error("VarInt is too big");
        }
    
        return value;
    }
}

export class ByteGenerator {
    secs: number[];

    constructor() {
        this.secs = [];
    }

    addI32BE(val: number) {
        this.secs = this.secs.concat([
            (val >> 24) & 0xFF,
            (val >> 16) & 0xFF,
            (val >> 8)  & 0xFF,
            (val >> 0)  & 0xFF
        ]);
    }

    addVarInt(value: number, add = true) {
        const SEGMENT_BITS = 0x7F;
        const CONTINUE_BIT = 0x80;

        const bytes: number[] = [];

        while (true) {
            if ((value & ~SEGMENT_BITS) == 0) {
                bytes.push(value);
                if(add) this.secs = this.secs.concat(bytes);
                return bytes;
            }

            bytes.push((value & SEGMENT_BITS) | CONTINUE_BIT);

            // Note: >>> means that the sign bit is shifted with the rest of the number rather than being left alone
            value >>>= 7;
        }
    }

    addString(s: string) {
        const encoder = new TextEncoder();
        this.addVarInt(s.length);
        this.secs = this.secs.concat(Array.from(encoder.encode(s)));
    }

    addShortString(s: string) {
        const encoder = new TextEncoder();
        this.addU16BE(s.length);
        this.secs = this.secs.concat(Array.from(encoder.encode(s)));
    }

    addArray(n: number[]) {
        this.secs = this.secs.concat(n);
    }

    addBool(b: boolean) {
        this.secs.push(b ? 1 : 0);
    }

    addU16BE(n: number) {
        this.secs = this.secs.concat([(n & 0xFF00) >> 8, n & 0xFF]);
    }

    addU8(n: number) {
        this.secs.push(n & 0xFF);
    }

    addI8(n: number) {
        this.secs.push(n & 0xFF);
    }

    addU8A(u8: Uint8Array) {
        this.secs = this.secs.concat(Array.from(u8));
    }

    clear() {
        this.secs = [];
    }

    toBuffer() {
        return Uint8Array.from(this.secs);
    }
}

export enum StoreType {
    Byte, Short, Int, VarInt, String
};

export type LocalStoreItem = { type: StoreType, name: string, val: string | number };

export class Store {
    static CUR_VERSION = 1;

    filename: string;
    bg: ByteGenerator;
    local: LocalStoreItem[];

    constructor(filename: string) {
        this.filename = filename;

        this.bg     = new ByteGenerator();
        this.local  = [];

        this.read();
    }

    write() {
        this.bg.clear();

        this.bg.addU8(Store.CUR_VERSION);   // current version
        this.bg.addU8(0);                   // compression type (0 = none)

        for(const item of this.local) {
            this.bg.addU8(item.type);
            this.bg.addShortString(item.name);
            switch(item.type) {
                case StoreType.Byte: this.bg.addU8(item.val as number); break;
                case StoreType.Short: this.bg.addU16BE(item.val as number); break;
                case StoreType.Int: this.bg.addI32BE(item.val as number); break;
                case StoreType.VarInt: this.bg.addVarInt(item.val as number); break;
                case StoreType.String: this.bg.addShortString(item.val as string); break;
            }
        }

        Deno.writeFileSync(this.filename, this.bg.toBuffer());
    }

    read() {
        if(!existsSync(this.filename)) {
            this.write();
        }

        const ib = new IndexedBuffer(Deno.readFileSync(this.filename));

        if(ib.readU8() != Store.CUR_VERSION)
            throw new Error(`Expected version ${Store.CUR_VERSION} but got ${ib.readU8(0)} instead!`);

        const compression = ib.readU8();

        if(compression != 0)
            throw new Error(`Compression not yet implemented!`);

        while(true) {
            const type = ib.readU8() as StoreType;
            if((type as number) == -1) break;
            const name = ib.readShortString();

            switch(type) {
                case StoreType.Byte: this.local.push({ type, name, val: ib.readU8() }); break;
                case StoreType.Short: this.local.push({ type, name, val: ib.readU16BE() }); break;
                case StoreType.Int: this.local.push({ type, name, val: ib.readI32BE() }); break;
                case StoreType.VarInt: this.local.push({ type, name, val: ib.readVarInt() }); break;
                case StoreType.String: this.local.push({ type, name, val: ib.readShortString() }); break;
                default: throw new Error(`Got unexpected store item type: "${type}"`);
            }
        }
    }

    exists(name: string) {
        for(const item of this.local) {
            if(item.name == name) return true;
        }
    }

    /**
     * Create an entry, unless it already exists.
     * @param name The name of the entry
     * @param type The type of the entry
     * @param val The value of the entry
     * @param local Whether to write to the file
     * @returns False if the file already exists, otherwise true.
     */
    createEntry(name: string, type: StoreType, val: string | number, local = false) {
        if(this.exists(name)) {
            return false;
        }

        this.local.push({ name, type, val });

        if(!local) this.write();

        return true;
    }

    /**
     * Update the entry with the name; for strings, it requires writing to `local`, then
     * calling `write` (or if it's local, it just writes to `local`)
     * @param name The name of the item
     * @param val The value to update the item to
     * @param local whether to write the changes
     */
    updateEntry(name: string, val: string | number, local = false) {
        for(let i=0;i<this.local.length;i++) {
            if(this.local[i].name == name) {
                if(typeof(val) == 'string' && this.local[i].type == StoreType.String) {
                    this.local[i].val = val;
                } else if(typeof(val) == 'string' && this.local[i].type != StoreType.String) {
                    throw new Error(`Tried to set a store value with a string when the item was not a string(type = ${this.local[i].type})`);
                } else {
                    this.local[i].val = val;
                }

                if(!local) this.write();

                break;
            }
        }
    }

    /**
     * Get an entry, or undefined if it can't find it
     * @param name The name of the entry to get
     * @returns The LocalStoreItem, or undefined if it doesn't exist
     */
    readEntry(name: string): LocalStoreItem | undefined {
        for(const item of this.local) {
            if(item.name == name) return item;
        }
    }

    /**
     * Remove an entry from the store.
     * @param name The name of the entry to remove
     * @param local Whether to save or not
     * @returns False if it couldn't find the entry to remove, otherwise true.
     */
    removeEntry(name: string, local = false) {
        for(let i=0;i<this.local.length;i++) {
            if(this.local[i].name == name) {
                this.local.splice(i, 1);
                if(!local) this.write();
                return true;
            }
        }

        return false;
    }
}