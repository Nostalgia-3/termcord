# termcord

A bad terminal client for Discord written in Deno.

## Quick Start

NOTE: the following instructions are not great, but I do not want to setup a login system. Have fun putting your token in a random file 👍.

Assuming you have installed Deno, run `deno run -A src/index.ts` to setup the termcord directory (located at `~/.termcord` on Linux and `%Appdata%/termcord` on Windows). There, you can find a `secrets.json`, with a field for a token. Put your Discord token there, and restart. Then, type `:connect`.
