#!/bin/sh
# Original script:
# Copyright 2013 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
# Modifications:
# Copyright 2015 Steve Dodier-Lazaro <sidnioulz@gmail.com>
# Modifications are under public domain
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
# Create directory to store native messaging host.
mkdir -p "$TARGET_DIR" "$TARGET_DIR_IUM"
# Copy native messaging host manifest.
cp "$DIR/$HOST_NAME.json" "$TARGET_DIR"
cp "$DIR/$HOST_NAME.json" "$TARGET_DIR_IUM"
# Copy native messaging python code.
cp "$DIR/$HOST_NAME" "$TARGET_DIR"
cp "$DIR/$HOST_NAME" "$TARGET_DIR_IUM"
# Update host path in the manifest.
HOST_PATH="$TARGET_DIR/$HOST_NAME"
HOST_PATH_IUM="$TARGET_DIR_IUM/$HOST_NAME"
sed -i -e "s@HOST_PATH@$HOST_PATH@" "$TARGET_DIR/$HOST_NAME.json"
sed -i -e "s@HOST_PATH@$HOST_PATH_IUM@" "$TARGET_DIR_IUM/$HOST_NAME.json"
# Set permissions for the manifest so that all users can read it.
chmod +r "$TARGET_DIR/$HOST_NAME.json" "$TARGET_DIR_IUM/$HOST_NAME.json"
# Set permissions for the Python script so that all users can run it.
chmod +x "$HOST_PATH" "$HOST_PATH_IUM"

echo "Native messaging host $HOST_NAME has been installed."
