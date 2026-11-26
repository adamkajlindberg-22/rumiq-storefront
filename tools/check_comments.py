"""Stoppar en vanlig miss: en //-kommentar mitt på en kodrad som sväljer koden efter den.
Körs: python3 tools/check_comments.py   (avslutar med 1 om något misstänkt hittas)
Skriv kommentarer mitt i en rad som /* ... */."""
import re,sys,pathlib
bad=0
for p in sorted(pathlib.Path(sys.argv[1] if len(sys.argv)>1 else ".").glob("assets/js/*.js")):
    if p.name.endswith(".min.js") or p.name.startswith("i18n-en"): continue
    for n,line in enumerate(p.read_text().splitlines(),1):
        # strip strings/templates/regex roughly: find '//' not preceded by ':' (urls) and not inside quotes
        s=re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`', '""', line)
        i=s.find('//')
        while i!=-1 and (i>0 and s[i-1] in ':\\*'):
            i=s.find('//',i+2)
        if i==-1 or not s[:i].strip(): continue
        tail=s[i+2:]
        if re.search(r';\s*(const|let|var|if|return|for|[A-Za-z_$][\w$.]*\s*(=|\())', tail) or re.search(r'\}\s*\)?\s*;?\s*$', tail) and len(tail)>200:
            bad+=1; print(f"{p.name}:{n}: {line.strip()[:140]}")
print(f"{bad} misstänkta rader" if bad else "OK: inga //-kommentarer som sväljer kod"); sys.exit(1 if bad else 0)
