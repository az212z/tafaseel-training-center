"""Exercise quota, retry, access and seeking on segmented private lesson videos."""
import json
import time
from urllib import error, request

from sandbox import Sandbox, ORIGIN

MIB = 1024 * 1024


def part(client, upload, index, data, expected=200, origin=ORIGIN):
    boundary = "video-" + str(time.time_ns())
    fields = {"id": upload, "index": index}
    body = b"".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
                    for key, value in fields.items())
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="part"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + data + f'\r\n--{boundary}--\r\n'.encode()
    req = request.Request(client.base + '/api/index.php?action=file.video.part', data=body, headers={
        'Origin': origin, 'X-CSRF-Token': client.csrf, 'Content-Type': 'multipart/form-data; boundary=' + boundary})
    try:
        response = client.http.open(req, timeout=90)
    except error.HTTPError as exc:
        response = exc
    with response:
        result = json.load(response)
        assert response.status == expected, (response.status, result)
        return result


def read(client, file_id, selection=None):
    return client.http.open(request.Request(client.base + '/api/index.php?action=file&id=' + file_id,
                           headers={'Range': selection} if selection else {}), timeout=90)


def test():
    with Sandbox(config_overrides={'storage_quota_bytes': 64*MIB}) as s:
        s.php(['-r', """require 'server/api.php';
        $pw=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
        foreach(['teacher'=>'instructor','student'=>'student','other'=>'instructor'] as $id=>$role)
            run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$pw,$role,now()]);
        run("INSERT INTO courses(id,title,description,category,image,status,instructor_id,capacity,created_at) VALUES('course','Video','desc','cat','img','published','teacher',20,?)",[now()]);
        run("INSERT INTO enrollments(id,student_id,course_id,created_at) VALUES('en','student','course',?)",[now()]);
        """])
        teacher, student, other = (s.login(name) for name in ('teacher','student','other'))
        fake = b'\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41'
        size = 32*MIB+1
        data = fake + bytes(size-len(fake)-1) + b'0'
        args = dict(course_id='course', name='lesson.mp4', bytes=size)
        for client in (student,other):
            client.post('file.video.begin', args, 403)
        teacher.post('file.video.begin', dict(args,bytes=10*1024*MIB+1), 413)
        rec = teacher.post('file.video.begin', args)
        uid, block = rec['id'],rec['part_bytes']
        teacher.post('file.video.begin', args, 409)
        part(other, uid, 0, data[:block], 404)
        part(teacher, uid, 1, data[block:2*block], 409)
        part(teacher, uid, 0, bytes(block), 422)
        for i, offset in enumerate(range(0,size,block)):
            result=part(teacher,uid,i,data[offset:offset+block])
            if i == 0:
                part(teacher,uid,0,data[:block])
        assert result['complete'] and part(teacher,uid,i,b'0')['id'] == uid
        assert not s.sql('SELECT id FROM upload_reservations')
        assert not s.sql('SELECT id FROM lesson_video_uploads')
        assert len(s.sql('SELECT id FROM files WHERE id=?',[uid])) == 1
        other.get('file.info&id='+uid,403)
        for start,end in ((0,25),(block-11,block+39),(size-1,size-1)):
            with read(student,uid,f'bytes={start}-{end}') as res:
                assert res.status == 206 and res.read()==data[start:end+1]
        with read(student,uid) as res:
            assert res.read()==data
        abandoned = teacher.post('file.video.begin',dict(args,bytes=block+1))['id']
        part(teacher,abandoned,0,data[:block])
        s.sql("UPDATE lesson_video_uploads SET expires_at='2000' WHERE id=?",[abandoned])
        part(teacher,abandoned,1,b'0',410)
        s.php(['-r',"require 'server/api.php'; cleanExpiredLessonParts(microtime(true)+8);"])
        assert not s.sql('SELECT id FROM upload_reservations')
        assert not list((s.folder/'storage/files').glob(abandoned+'*'))
        print('PASS: segmented video, retry, quota, access, full/partial reads and abandoned upload cleanup')


if __name__=='__main__':
    test()
