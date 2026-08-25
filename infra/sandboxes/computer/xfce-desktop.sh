#!/usr/bin/env bash
# Brings up the Xfce pieces individually rather than through xfce4-session.
# The session manager wants a login session and a settings daemon that a
# container does not have, and when it gives up it leaves no window manager at
# all — a blank screen with nothing explaining why. Starting the three parts
# directly keeps the failure of any one of them visible in its own log.
set -uo pipefail
export DISPLAY="${DISPLAY:-:1}"
LOGS=/tmp/rakazo
mkdir -p "$LOGS"

# Config lives outside the bot's home so it survives a home that predates it.
export XDG_CONFIG_HOME=/tmp/xfce-config
mkdir -p "$XDG_CONFIG_HOME/xfce4/xfconf/xfce-perchannel-xml"

# A single dark desktop, no icons, no wallpaper to distract the model.
cat > "$XDG_CONFIG_HOME/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-desktop" version="1.0">
  <property name="backdrop" type="empty">
    <property name="screen0" type="empty">
      <property name="monitorscreen" type="empty">
        <property name="workspace0" type="empty">
          <property name="color-style" type="int" value="0"/>
          <property name="rgba1" type="array">
            <value type="double" value="0.051"/>
            <value type="double" value="0.051"/>
            <value type="double" value="0.055"/>
            <value type="double" value="1.0"/>
          </property>
          <property name="image-style" type="int" value="0"/>
        </property>
      </property>
    </property>
  </property>
  <property name="desktop-icons" type="empty">
    <property name="style" type="int" value="0"/>
  </property>
</channel>
XML

# Xfce ships two panels by default — a menu bar and a launcher dock. One is
# enough: the dock is launchers the bot never clicks, and it sits over the
# bottom of every page the model looks at.
cat > "$XDG_CONFIG_HOME/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-panel" version="1.0">
  <property name="panels" type="array">
    <value type="int" value="1"/>
    <property name="panel-1" type="empty">
      <property name="position" type="string" value="p=6;x=0;y=0"/>
      <property name="length" type="uint" value="100"/>
      <property name="position-locked" type="bool" value="true"/>
      <property name="size" type="uint" value="28"/>
      <property name="plugin-ids" type="array">
        <value type="int" value="1"/>
        <value type="int" value="2"/>
        <value type="int" value="3"/>
      </property>
    </property>
  </property>
  <property name="plugins" type="empty">
    <property name="plugin-1" type="string" value="applicationsmenu"/>
    <property name="plugin-2" type="string" value="tasklist"/>
    <property name="plugin-3" type="string" value="clock"/>
  </property>
</channel>
XML

xfwm4 --compositor=off --replace >"$LOGS/xfwm4.log" 2>&1 &
for _ in $(seq 1 40); do
  pgrep -x xfwm4 >/dev/null 2>&1 && break
  sleep 0.1
done

xfsettingsd >"$LOGS/xfsettingsd.log" 2>&1 &
xfdesktop --disable-wm-check >"$LOGS/xfdesktop.log" 2>&1 &
xfce4-panel --disable-wm-check >"$LOGS/xfce4-panel.log" 2>&1 &

wait
