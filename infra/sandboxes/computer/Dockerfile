# Debian 13 (trixie): bookworm pinned Node 18, which is end-of-life, and
# Python 3.11. Trixie ships Node 20 LTS and Python 3.13.
FROM debian:trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Desktop the Computer tools drive. Xfce rather than a minimal window
    # manager: models are grounded on conventional desktops, and both the
    # Anthropic and E2B computer-use environments made the same choice.
    xvfb \
    x11vnc \
    xfwm4 \
    xfdesktop4 \
    xfce4-panel \
    xfce4-settings \
    xfce4-terminal \
    thunar \
    xdg-utils \
    xdotool \
    scrot \
    x11-utils \
    x11-xserver-utils \
    novnc \
    websockify \
    dbus-x11 \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    imagemagick \
    # Applications. A computer-use agent that can only open a browser cannot
    # read a PDF it downloaded or edit a file it wrote — the same dead end the
    # missing HTTP client caused, one layer up.
    mousepad \
    evince \
    ristretto \
    # Fetching. A bot with no HTTP client drives the browser by hand and
    # loops; wget used to be here only as another package's dependency.
    ca-certificates \
    gnupg \
    curl \
    wget \
    openssh-client \
    rsync \
    dnsutils \
    iputils-ping \
    netcat-openbsd \
    # Reading and reshaping what it fetched.
    jq \
    sqlite3 \
    ripgrep \
    fd-find \
    bat \
    file \
    tree \
    less \
    # Archives.
    unzip \
    zip \
    xz-utils \
    bzip2 \
    # Editing in place, for when write_file is the wrong shape.
    nano \
    vim-tiny \
    # Version control and runtimes.
    git \
    git-lfs \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    build-essential \
    # Media the graphical tools cannot do headlessly.
    ffmpeg \
    procps \
    psmisc \
  && rm -rf /var/lib/apt/lists/*

# Debian ships these under names a model does not reach for first.
RUN ln -sfn /usr/bin/fdfind /usr/local/bin/fd \
  && ln -sfn /usr/bin/batcat /usr/local/bin/bat \
  && ln -sfn /usr/bin/vi /usr/local/bin/vim

# bun and uv are not packaged by Debian. Install into /usr/local so they are
# on PATH for every shell, not just an interactive login.
ENV BUN_INSTALL=/usr/local
RUN curl -fsSL https://bun.sh/install | bash \
  && bun --version
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh \
  && uv --version

RUN mkdir -p /usr/share/rakazo/reference \
  && ln -sfn /bin/true /usr/bin/xmessage

ENV DISPLAY=:1
ENV HOME=/home/rakazo
WORKDIR /home/rakazo
COPY start.sh /usr/local/bin/rakazo-computer
COPY rakazo-browser /usr/local/bin/rakazo-browser
COPY rakazo-doctor /usr/local/bin/rakazo-doctor
COPY xfce-desktop.sh /usr/local/bin/rakazo-desktop
# Reference lives outside /home/rakazo: that path is bind-mounted per bot, so
# anything baked there is hidden at runtime.
COPY reference/using-this-computer.md /usr/share/rakazo/reference/using-this-computer.md
COPY embed.html /usr/share/novnc/embed.html
# Strip CR so shebangs work even if the build context came from a CRLF checkout.
RUN sed -i 's/\r$//' /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser \
    /usr/local/bin/rakazo-doctor /usr/local/bin/rakazo-desktop \
  && chmod +x /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser \
    /usr/local/bin/rakazo-doctor /usr/local/bin/rakazo-desktop
EXPOSE 6080 6081 6082 6083 6084 6085 6086 6087 6088 6089 6090 6091 6092 6093 6094 6095
CMD ["/usr/local/bin/rakazo-computer"]
