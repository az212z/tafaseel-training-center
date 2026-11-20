"""Large and legacy attachment compatibility, range reads and course isolation."""
import hashlib
from sandbox import Sandbox
from lesson_video_uploads import read

with Sandbox() as s:
    s.php(['-r', """require 'server/api.php';
        $pw=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
        foreach(['teacher'=>'instructor','reader'=>'student','other'=>'student'] as $id=>$role)
            run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$pw,$role,now()]);
        run("INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES('course','Course','desc','cat','img','published','teacher',?)",[now()]);
        run("INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES('en','course','reader',?)",[now()]);
    """])
    teacher, reader, other = [s.login(id) for id in ['teacher','reader','other']]
    block = 1024 * 1024
    for size in (block-1, block, 3*block+17):
        pdf = (b'%PDF-1.4\n' + bytes(range(251)) * (size//251+1))[:size]
        fid = teacher.upload(pdf,'lesson.pdf','application/pdf','course')['id']
        record = s.sql('SELECT storage_name FROM files WHERE id=?',[fid])[0]
        assert record['storage_name'].endswith('.pack1') == (size >= block)
        if size >= block:
            for start,end in [(0,3),(block-9,min(block+32,size-1)),(size-13,size-1)]:
                with read(reader,fid,f'bytes={start}-{end}') as response:
                    assert response.status == 206 and response.read() == pdf[start:end+1]
                    assert response.headers['Content-Range'] == f'bytes {start}-{end}/{size}'
        with read(reader,fid) as response:
            assert response.status == 200 and hashlib.file_digest(response,'sha256').digest()==hashlib.sha256(pdf).digest()
        other.get('file.info&id='+fid,403)
    print('PASS: small and packed private PDFs, aligned and cross-frame ranges, tail, checksum and course permissions')
