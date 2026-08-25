# Using this computer

This is a Debian container with a graphical desktop. Your home directory
persists between turns; the rest of the filesystem is rebuilt from the image
whenever the computer restarts.

## What is installed

- **Fetching**: `curl`, `wget`, `openssh-client`, `rsync`, `dig`, `ping`, `nc`
- **Data**: `jq`, `sqlite3`, `ripgrep` (`rg`), `fd`, `bat`, `file`, `tree`, `less`
- **Archives**: `unzip`, `zip`, `xz`, `bzip2`, `tar`, `gzip`
- **Editing**: `nano`, `vim`
- **Version control**: `git`, `git-lfs`
- **Runtimes**: `python3` with `pip` and `venv`, `uv`, `node` with `npm`, `bun`
- **Building**: `build-essential`, so `pip` and `npm` can compile native modules
- **Media**: `ffmpeg`, ImageMagick (`convert`)

Prefer the shell for fetching and processing. Driving the browser by hand to
read a page is slow and tends to loop; use `curl` and parse the result.

## Installing more

Install into your home directory so it survives a restart:

- Python: `pip install --user <pkg>`, or `uv tool install <pkg>`
- Node: `npm install -g <pkg>` (prefixed to your home), or `bun add -g <pkg>`

`apt install` works but is lost on restart, because only your home persists.

## When something breaks

Run `rakazo-doctor`. It checks DNS, outbound HTTPS, the tools above, the X
server, Chromium, the window manager, `/etc/machine-id`, the D-Bus session, the
clock, and that your home is writable. It prints one `PASS`/`FAIL` line per
check and a summary. Its startup result is at `/tmp/rakazo/doctor.log`.

Run it before guessing at an unexplained failure — a timeout with no clear
cause is usually one of those checks, and retrying a broken command in
variations will trip the repeated-tool guard and end your turn early.

Other logs live in `/tmp/rakazo/`: `xvfb.log`, `fluxbox.log`, `browser.log`,
`x11vnc.log`, `novnc.log`.

## The desktop

Display `:1`. Launch the browser with `rakazo-browser` rather than a raw
chromium binary, so it gets the right profile and flags. Use the Computer tools
to see and click the screen; do not automate input from the shell with
`xdotool`.
