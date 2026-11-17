#!/bin/bash
# Uso: fetch.sh TAG TOTAL AUDIO.wav SALIDA.mp4
set -e
TAG=$1; TOTAL=$2; AUDIO=$3; OUT=$4; REPO=xmp24/pueblo-brum
D=/home/claude/gh_$TAG; rm -rf $D; mkdir -p $D; cd $D
git init -q g; cd g
git fetch -q --depth 1 https://github.com/$REPO "+refs/heads/out-$TAG-*:refs/remotes/o/out-$TAG-*"
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/o/); do
  i=${b##*-}; mkdir -p ../seg-$i; git archive $b | tar -x -C ../seg-$i; done
cd ..; rm -rf g
for d in $(ls -d seg-* | sort -t- -k2 -n); do
  openssl pkeyutl -decrypt -inkey ~/.atlas/render_priv.pem -in $d/k.enc -out k.txt
  openssl enc -d -aes-256-cbc -pbkdf2 -pass file:k.txt -in $d/seg.bin -out $d.mp4; rm k.txt
  echo "file '$d.mp4'" >> list.txt
done
tot=0; for f in seg-*.mp4; do n=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 $f); tot=$((tot+n)); done
[ $tot = $TOTAL ] || { echo "QA FALLO: $tot de $TOTAL"; exit 1; }
DUR=$(python3 -c "print($TOTAL/30)")
ffmpeg -v error -y -f concat -safe 0 -i list.txt -i $AUDIO -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t $DUR -movflags +faststart $OUT
n=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 $OUT)
[ $n = $TOTAL ] || { echo "QA FALLO final $n"; exit 1; }
echo "QA OK $OUT $n fotogramas"
