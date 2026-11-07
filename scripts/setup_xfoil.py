"""Acquire the pinned small MIT Windows distribution locally, never system-wide."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1] / 'tools/xfoil'
URL = 'https://web.mit.edu/drela/Public/web/xfoil/XFOIL6.99.zip'
ARCHIVE_HASH = 'e13e8fe5cc38d8ac2626e9d3b17643bdcfaa63791619f042afdaa7cd103bcb08'
EXECUTABLE_HASH = 'c17342f84ae260c2b11a74cd0e2fb8189a5f8954c6bb7a8467a0f27055c7faea'

if ROOT.exists():
    raise SystemExit('Refusing to overwrite tools/xfoil. Inspect/reuse the existing installation.')
ROOT.mkdir(parents=True)
with urllib.request.urlopen(URL, timeout=30) as response:
    data = response.read(6_000_001)
if len(data) > 6_000_000 or hashlib.sha256(data).hexdigest() != ARCHIVE_HASH:
    raise SystemExit('Archive size/hash mismatch; do not execute or silently update the pin.')
archive = ROOT / 'XFOIL6.99.zip'
archive.write_bytes(data)
with zipfile.ZipFile(archive) as bundle:
    for entry in bundle.infolist():
        if entry.filename == '/':
            continue  # Known archive root marker; never extract an absolute path.
        destination = (ROOT / entry.filename).resolve()
        if not destination.is_relative_to(ROOT.resolve()) or entry.file_size > 10_000_000:
            raise SystemExit('Unexpected archive entry')
        if not entry.is_dir():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(bundle.read(entry))
if hashlib.sha256((ROOT / 'xfoil.exe').read_bytes()).hexdigest() != EXECUTABLE_HASH:
    raise SystemExit('Executable hash mismatch; do not execute')
(ROOT / 'acquisition.json').write_text(json.dumps({'url': URL, 'archive_bytes': len(data),
    'archive_sha256': ARCHIVE_HASH, 'executable_sha256': EXECUTABLE_HASH}, indent=2) + '\n')
print('Installed pinned XFOIL 6.99 locally; GPL executable/source archive remain outside Git.')
