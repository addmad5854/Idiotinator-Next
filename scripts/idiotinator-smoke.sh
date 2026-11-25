#!/usr/bin/env bash
set -euo pipefail
pkg=com.personal.idiotinator.next
adb install -r android/app/build/outputs/apk/prod/release/app-prod-release.apk
adb logcat -c
trap 'adb logcat -d > startup-log.txt' EXIT
adb shell am start -W -n "$pkg/com.pocketpal.MainActivity"
sleep 25
adb shell pidof "$pkg"
adb shell uiautomator dump /sdcard/idiotinator-window.xml
adb shell cat /sdcard/idiotinator-window.xml > /tmp/idiotinator-window.xml
if grep -qi 'Idiotinator startup error' /tmp/idiotinator-window.xml; then exit 1; fi
adb logcat -d -b crash > /tmp/idiotinator-crash.txt
if grep -Fq "$pkg" /tmp/idiotinator-crash.txt; then cat /tmp/idiotinator-crash.txt; exit 1; fi
