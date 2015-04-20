#!/bin/sh
# Copyright 2015 Steve Dodier-Lazaro <sidnioulz@gmail.com>
# Under public domain
set -e
DIR="$( cd "$( dirname "$0" )" && pwd )"
if [ x"$(whoami)" = x"root" ]; then
    TARGET_DIR="/etc/opt/chrome/native-messaging-hosts"
    TARGET_DIR_IUM="/etc/chromium-browser/native-messaging-hosts"
else
    TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    TARGET_DIR_IUM="$HOME/.config/chromium/NativeMessagingHosts"
fi
HOST_NAME=uk.ac.ucl.cs.study.multitasking.chrome #.debug

# Remove manifest.
rm "$TARGET_DIR/$HOST_NAME.json" "$TARGET_DIR_IUM/$HOST_NAME.json"
# Remove native messaging python code.
rm "$TARGET_DIR/$HOST_NAME" "$TARGET_DIR_IUM/$HOST_NAME"

echo "Native messaging host $HOST_NAME has been removed."
