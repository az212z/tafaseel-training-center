from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[1]
out=root/'output';out.mkdir(exist_ok=True)
files=[]
with ZipFile(out/'tafaseel-learning-hostinger.zip','w',ZIP_DEFLATED) as z:
    for file in sorted((root/'dist').rglob('*')):
        if file.is_file():
            target='public_html/'+str(file.relative_to(root/'dist'))
            z.write(file,target);files.append({'path':target,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    for file in sorted((root/'server').glob('*')):
        if file.is_file() and file.name not in ['config.php','router.php','preview-router.php']:
            target='tafaseel-learning-private/'+file.name
            z.write(file,target);files.append({'path':target,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    vendor=root/'vendor'
    if not (vendor/'autoload.php').is_file():
        raise SystemExit('Run composer install --no-dev before packaging.')
    for file in sorted(vendor.rglob('*')):
        if file.is_file() and file.name != '.DS_Store':
            target='tafaseel-learning-private/vendor/'+str(file.relative_to(vendor))
            z.write(file,target);files.append({'path':target,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    for name in ['composer.json','composer.lock']:
        z.write(root/name,'tafaseel-learning-private/'+name)
    for p in sorted((root/'docs').rglob('*')):
        if p.is_file() and p.name!='.DS_Store':z.write(p,str(p.relative_to(root)))
    z.write(root/'README.md','README.md')
    z.writestr('manifest.json',json.dumps(files,indent=2))
with ZipFile(out/'tafaseel-learning-hostinger.zip') as z:
    names=z.namelist()
    assert not any(x.endswith('/config.php') or '.sqlite' in x or 'accounts.json' in x or '/.local/' in x for x in names)
    assert 'public_html/api/index.php' in names
    assert 'public_html/.htaccess' in names
    assert 'tafaseel-learning-private/schema.sql' in names
    assert 'tafaseel-learning-private/schema-v2.sql' in names
    assert 'tafaseel-learning-private/vendor/autoload.php' in names
    assert not any(x.startswith('public_html/vendor/') for x in names)
print(json.dumps({'archive':str(out/'tafaseel-learning-hostinger.zip'),'files':len(names),'secrets_included':False},indent=2))
