#!/bin/bash
# muestra cuántas piezas hay en GitHub por vídeo
cd /home/claude/pueblo-brum
git ls-remote https://github.com/xmp24/pueblo-brum 'refs/heads/out-*' 2>/dev/null | awk '{print $2}' | sed 's#refs/heads/out-##; s#-[0-9]*$##' | sort | uniq -c
