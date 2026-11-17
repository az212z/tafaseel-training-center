"""Prepare a public, browser-only GitHub Pages build. Never copy server files."""
from pathlib import Path
import hashlib
import json
import shutil

root = Path(__file__).resolve().parents[1]
out = root / 'dist-preview'
for entry in ['api', '.htaccess', '.user.ini']:
    path = out / entry
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()
html = out / 'index.html'
s = html.read_text().replace('تفاصيل | المنصة التعليمية', 'تفاصيل | نسخة عرض تجريبية')
s = s.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' blob: data:; media-src \'self\' blob:; font-src \'self\'; connect-src \'self\'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; object-src \'none\'; base-uri \'self\'; form-action \'none\'"/>')
html.write_text(s)
(out / '.nojekyll').touch()
(out / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
manifest = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file() and p.name != 'build-manifest.json'}
(out / 'build-manifest.json').write_text(json.dumps({'mode': 'browser-preview', 'files': manifest}, indent=2) + '\n')
for p in out.rglob('*'):
    if p.is_file() and (p.suffix in ['.php', '.sqlite', '.db', '.zip'] or p.name in ['config.php', 'accounts.json']):
        raise SystemExit(f'Unexpected private or executable file: {p}')
print(f'Public preview ready: {len(manifest)} files. No PHP, database or private configuration.')
