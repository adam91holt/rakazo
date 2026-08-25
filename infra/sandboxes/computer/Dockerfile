FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    xdotool \
    x11-utils \
    x11-xserver-utils \
    imagemagick \
    novnc \
    websockify \
    dbus-x11 \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    procps \
    psmisc \
    bash \
    ca-certificates \
    gnupg \
    # Fetching: a bot with no HTTP client falls back to driving the browser by
    # hand, which is slow and loops. wget was only ever present transitively.
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
    file \
    tree \
    less \
    # Archives.
    unzip \
    zip \
    xz-utils \
    bzip2 \
    # Editing in place, for the times write_file is the wrong shape.
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
    # Media work the graphical tools cannot do headlessly.
    ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /etc/rakazo/fluxbox \
  && printf '%s\n' '#!/bin/sh' 'exec xsetroot -solid "#111113" "$@"' > /usr/bin/fbsetbg \
  && chmod +x /usr/bin/fbsetbg \
  && ln -sfn /bin/true /usr/bin/xmessage
ENV DISPLAY=:1
ENV HOME=/home/rakazo
WORKDIR /home/rakazo
COPY start.sh /usr/local/bin/rakazo-computer
COPY rakazo-browser /usr/local/bin/rakazo-browser
COPY fluxbox.init /etc/rakazo/fluxbox/init
COPY fluxbox.apps /etc/rakazo/fluxbox/apps
COPY fluxbox.menu /etc/rakazo/fluxbox/menu
COPY embed.html /usr/share/novnc/embed.html
# Strip CR so shebangs work even if the build context came from a CRLF checkout.
RUN sed -i 's/\r$//' /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser \
    /etc/rakazo/fluxbox/init /etc/rakazo/fluxbox/apps /etc/rakazo/fluxbox/menu \
  && chmod +x /usr/local/bin/rakazo-computer /usr/local/bin/rakazo-browser
EXPOSE 6080 6081 6082 6083 6084 6085 6086 6087 6088 6089 6090 6091 6092 6093 6094 6095
CMD ["/usr/local/bin/rakazo-computer"]
