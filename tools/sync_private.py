#!/usr/bin/env python3
"""Gleicht die NICHT in Git versionierten Ordner (private/, Bilder_roh/ ...)
zwischen diesem Klon und dem Synology-/NAS-Ordner in beide Richtungen ab.

Regeln:
- Datei nur auf einer Seite      -> wird auf die andere kopiert
- Datei auf beiden Seiten anders -> die neuere gewinnt; die alte Fassung
                                    wird vorher in einen Backup-Ordner gesichert
- Löschungen werden NICHT übertragen (gelöschte Dateien kommen sonst zurück:
  auf beiden Seiten löschen)

Aufruf:
    python3 tools/sync_private.py            # abgleichen
    python3 tools/sync_private.py --dry-run  # nur anzeigen, was passieren würde

Der NAS-Pfad steht in .claude/sync-nas.json (wird von Git ignoriert):
    {"nas_dir": "/Pfad/zum/Synology/Ordner"}
"""
import argparse
import filecmp
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / ".claude" / "sync-nas.json"
BACKUP_ROOT = REPO.parent / ".sync-backup" / REPO.name

# Ordner, die laut .gitignore nicht ins Repo gehören
FOLDERS = ["private", "Bilder_roh", "exports", "originale", "knowledge/buch"]
SKIP_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SKIP_PREFIXES = ("~$", "._", ".~lock")
MTIME_TOLERANCE = 2  # Sekunden (SMB/Synology runden Zeitstempel)


def load_nas_dir():
    try:
        nas = Path(json.loads(CONFIG.read_text(encoding="utf-8"))["nas_dir"])
    except (OSError, KeyError, ValueError):
        sys.exit(f"Konfiguration fehlt oder ist kaputt: {CONFIG}\n"
                 'Inhalt z. B.: {"nas_dir": "/Pfad/zum/NAS/Ordner"}')
    if not nas.is_dir():
        sys.exit(f"NAS-Ordner nicht gefunden: {nas}")
    return nas


def list_files(base):
    files = {}
    for folder in FOLDERS:
        root = base / folder
        if not root.is_dir():
            continue
        for p in root.rglob("*"):
            if p.is_file() and p.name not in SKIP_NAMES and not p.name.startswith(SKIP_PREFIXES):
                files[p.relative_to(base).as_posix()] = p
    return files


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="nur anzeigen, nichts kopieren")
    ap.add_argument("--summary", action="store_true", help="nur eine Zeile ausgeben, und nur wenn kopiert wurde")
    args = ap.parse_args()

    nas = load_nas_dir()
    sides = {"Mac-Klon": REPO, "NAS": nas}
    local, remote = list_files(REPO), list_files(nas)
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    actions = []  # (rel, quelle, ziel, backup?)

    for rel in sorted(set(local) | set(remote)):
        a, b = local.get(rel), remote.get(rel)
        if a and not b:
            actions.append((rel, "Mac-Klon", "NAS", False))
        elif b and not a:
            actions.append((rel, "NAS", "Mac-Klon", False))
        elif not filecmp.cmp(a, b):  # gleiche Größe+Zeit = gleich, sonst Inhalt prüfen
            ma, mb = a.stat().st_mtime, b.stat().st_mtime
            if abs(ma - mb) <= MTIME_TOLERANCE:
                print(f"  KONFLIKT (gleich alt, Inhalt anders) – bitte von Hand prüfen: {rel}")
                continue
            src, dst = ("Mac-Klon", "NAS") if ma > mb else ("NAS", "Mac-Klon")
            actions.append((rel, src, dst, True))

    if not actions:
        if not args.summary:
            print("Alles synchron.")
        return

    for rel, src, dst, overwrite in actions:
        verb = "aktualisiert" if overwrite else "neu"
        if not args.summary:
            print(f"  {src:8} -> {dst:8} [{verb}] {rel}")
        if args.dry_run:
            continue
        target = sides[dst] / rel
        if overwrite:
            backup = BACKUP_ROOT / stamp / dst / rel
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, backup)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(sides[src] / rel, target)

    n = len(actions)
    if args.summary:
        richtung = sorted({f"{src}->{dst}" for _, src, dst, _ in actions})
        print(f"private/Bilder_roh mit NAS abgeglichen: {n} Datei(en) kopiert ({', '.join(richtung)}).")
        return
    if args.dry_run:
        print(f"\n{n} Datei(en) würden kopiert (Probelauf, nichts geändert).")
    else:
        print(f"\n{n} Datei(en) kopiert.")
        if any(o for *_, o in actions):
            print(f"Überschriebene Fassungen gesichert in: {BACKUP_ROOT / stamp}")


if __name__ == "__main__":
    main()
