#!/bin/bash
# Final build v2: merged hi-res mattes → realism layers → cleaned person frames → render → loudness
set -e
W=/home/user/Testvidei/work; S=$(echo /root/.claude/skills/synced/*/video-editor-bassam)
cd $W
python3 build_layers.py
python3 compose_person.py mmask mg/public/p cut_hq.mov cut_dn.mov
cd mg && npx remotion render src/index.ts Main ../ad-final.mp4 --crf=14 --audio-codec=aac --audio-bitrate=256k --concurrency=2 --log=error
cd $W && bash $S/scripts/06b_master.sh $W $W/ad-final.mp4 $W/ad-master.mp4
