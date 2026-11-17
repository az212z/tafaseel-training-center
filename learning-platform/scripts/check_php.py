from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
files=sorted((root/'server').glob('*.php'))+sorted((root/'public/api').glob('*.php'))
failed=[]
for path in files:
    if path.name=='config.php':continue
    result=subprocess.run(['php','-l',str(path)],text=True,capture_output=True)
    print((result.stdout+result.stderr).strip())
    if result.returncode:failed.append(str(path.relative_to(root)))
if failed:print('PHP syntax check failed: '+', '.join(failed),file=sys.stderr)
sys.exit(1 if failed else 0)
