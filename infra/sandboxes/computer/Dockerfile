# Debian 13 (trixie): bookworm pinned Node 18, which is end-of-life, and
# Python 3.11. Trixie ships Node 20 LTS and Python 3.13.
FROM debian:trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Desktop the Computer tools drive.
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    xdotool \
    x11-utils \
    x11-xserver-utils \
    novnc \
    websockify \
    dbus-x11 \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    imagemagick \
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

RUN mkdir -p /etc/rakazo/fluxbox /usr/share/rakazo/reference \
  && printf '%s\n' '#!/bin/sh' 'exec xsetroot -solid "#0D0D0E" "$@"' > /usr/bin/fbsetbg \
  && chmod +x /usr/bin/fbsetbg \
  && ln -sfn /bin/true /usr/bin/xmessage

ENV DISPLAY=:1
ENV HOME=/home/rakazo
WORKDIR /home/rakazo
COPY start.sh /usr/local/bin/rakazo-computer
COPY rakazo-browser /usr/local/bin/rakazo-browser
COPY rakazo-doctor /usr/local/bin/rakazo-doctor
COPY fluxbox.init /etc/rakazo/fluxbox/init
COPY fluxbox.apps /etc/rakazo/fluxbox/apps
COPY fluxbox.menu /etc/rakazo/fluxbox/menu
COPY fluxbox.style /etc/rakazo/fluxbox/style
# Reference lives outside /home/rakazo: that path is bind-mounted per bot, so
# anything baked there is hidden at runtime.
COPY reference/using-this-computer.md /usr/share/rakazo/reference/using-this-computer.md
COPY embed.html /usr/share/novnc/embed.html
# Strip CR so shebangs work even if the build context came from a CRLF checkout.
RUN sed -i 's/\r$//' /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser \
    /usr/local/bin/rakazo-doctor /etc/rakazo/fluxbox/init /etc/rakazo/fluxbox/apps \
    /etc/rakazo/fluxbox/menu \
  && chmod +x /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser \
    /usr/local/bin/rakazo-doctor
EXPOSE 6080 6081 6082 6083 6084 6085 6086 6087 6088 6089 6090 6091 6092 6093 6094 6095
CMD ["/usr/local/bin/rakazo-computer"]
