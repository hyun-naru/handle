import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const app = express();

// 💡 환경변수(PORT)가 있으면 서버 환경, 없으면 로컬 기본 3000 포트 사용
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.PORT;

// 저장할 디렉터리 경로 설정 및 폴더 자동 생성 (없으면 자동 생성)
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'bug_reports.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// JSON 파일 읽기/쓰기 유틸리티 함수
const getBugList = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        return [];
    }
};

const saveBugList = (list) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf8');
};

// 미들웨어
app.use(cors({
    origin: '*', // 모든 도메인에서의 API 요청 허용
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // Base64 이미지 수신을 위해 용량 확대
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// 1. 버그 리포트 저장 (JSON 저장 + PNG 파일 저장)
app.post(['/api/bugreport/save.json', '/handle/api/bugreport/save.json'], (req, res) => {
    try {
        const { bugId, reporter, comment, imageData, reopenTargetId } = req.body;
        let imagePath = '';

        // Base64 이미지 스트링 -> 실제 .png 파일로 저장
        if (imageData && imageData.includes('base64,')) {
            const base64Data = imageData.split('base64,')[1];
            const fileName = `${bugId}.png`;
            const filePath = path.join(UPLOAD_DIR, fileName);
            fs.writeFileSync(filePath, base64Data, 'base64');
            imagePath = `/api/bugreport/image.json?bugId=${fileName}`;
        }

        // JSON 데이터베이스(data/bug_reports.json) 업데이트
        const bugList = getBugList();
        const newBug = {
            bugId: bugId || Date.now().toString(),
            reporter: reporter || '익명',
            assignee: '미정',
            comment: comment || '',
            devComment: '',
            status: 'N',
            imagePath: imagePath,
            reopenTargetId: reopenTargetId || '',
            createdAt: new Date().toISOString()
        };

        bugList.push(newBug);
        saveBugList(bugList);

        console.log(`✅ [저장 완료] 버그 ID: ${newBug.bugId}, 작성자: ${newBug.reporter}`);
        res.json({ success: true, message: '버그 리포트가 성공적으로 저장되었습니다.' });
    } catch (err) {
        console.error('❌ 저장 중 오류 발생:', err);
        res.status(500).json({ success: false, message: '파일 저장 실패' });
    }
});
// 📌 관리자 - 담당 개발자 배정 API (POST)
app.post(['/api/bugreport/assign.json', '/handle/api/bugreport/assign.json'], (req, res) => {
    try {
        const { bugId, assignee } = req.body;

        if (!bugId || !assignee) {
            return res.status(400).json({ status: 'fail', message: 'bugId 또는 assignee가 누락되었습니다.' });
        }

        console.log(`👤 담당자 배정 요청 - ID: ${bugId}, 담당자: ${assignee}`);

        // 1. 기존 버그 리스트 가져오기 (기존 getBugList 함수 사용)
        let bugList = getBugList();

        // 2. 해당 bugId 찾아서 assignee 변경
        let isUpdated = false;
        bugList = bugList.map(bug => {
            if (bug.bugId.toString() === bugId.toString()) {
                bug.assignee = assignee;
                isUpdated = true;
            }
            return bug;
        });

        if (!isUpdated) {
            return res.status(404).json({ status: 'fail', message: '해당 결함 ID를 찾을 수 없습니다.' });
        }

        // 3. JSON 파일에 저장 (기존 saveBugList 또는 fs.writeFileSync 사용)
        const DATA_FILE = path.join(process.cwd(), 'data', 'bug_reports.json');
        fs.writeFileSync(DATA_FILE, JSON.stringify(bugList, null, 2), 'utf-8');

        console.log(`✅ [${bugId}] 담당자 배정 완료: ${assignee}`);
        return res.json({ status: 'success', message: '담당자가 변경되었습니다.' });

    } catch (err) {
        console.error('❌ 담당자 배정 중 오류:', err);
        return res.status(500).json({ status: 'fail', message: '서버 오류가 발생했습니다.' });
    }
});
// 📌 결함 상태 및 개발자 코멘트 업데이트 API (POST)
app.post(['/api/bugreport/update.json', '/handle/api/bugreport/update.json'], (req, res) => {
    try {
        const { bugId, status, devComment } = req.body;

        if (!bugId) {
            return res.status(400).json({ status: 'fail', message: 'bugId가 누락되었습니다.' });
        }

        console.log(`⚙️ 결함 업데이트 요청 - ID: ${bugId}, 상태: ${status}, 개발자 코멘트: ${devComment}`);

        // 1. 기존 버그 리스트 가져오기
        let bugList = getBugList();

        // 2. 해당 bugId를 찾아 상태(status) 및 개발자 코멘트(devComment) 업데이트
        let isUpdated = false;
        bugList = bugList.map(bug => {
            if (bug.bugId.toString() === bugId.toString()) {
                // status가 넘어온 경우에만 업데이트 (undefined/null 체크)
                if (status !== undefined) {
                    bug.status = status;
                }
                // devComment가 넘어온 경우에만 업데이트
                if (devComment !== undefined) {
                    bug.devComment = devComment;
                }
                isUpdated = true;
            }
            return bug;
        });

        if (!isUpdated) {
            return res.status(404).json({ status: 'fail', message: '해당 결함 ID를 찾을 수 없습니다.' });
        }

        // 3. JSON 파일 저장
        const DATA_FILE = path.join(process.cwd(), 'data', 'bug_reports.json');
        fs.writeFileSync(DATA_FILE, JSON.stringify(bugList, null, 2), 'utf-8');

        console.log(`✅ [${bugId}] 업데이트 성공 (상태: ${status})`);
        return res.json({ status: 'success', message: '성공적으로 저장되었습니다.' });

    } catch (err) {
        console.error('❌ 결함 업데이트 중 오류:', err);
        return res.status(500).json({ status: 'fail', message: '서버 내부 오류가 발생했습니다.' });
    }
});
// 📌 버그 리포트 목록 조회 (저장된 JSON 읽어오기)
app.get(['/api/bugreport/list.json', '/handle/api/bugreport/list.json'], (req, res) => {
    console.log('📌 버그 리포트 목록 조회 요청 수신');
    const bugList = getBugList();
    res.json(bugList);
});

// 📌 3. 이미지 파일 제공 (캡처보기 버튼 대응)
app.get('/api/bugreport/image.json', (req, res) => {
    const bugId = req.query.bugId;
    if (!bugId) return res.status(400).send('File not found');

    const fileName = bugId.endsWith('.png') ? bugId : `${bugId}.png`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Image Not Found');
    }
});
// 📌 엑셀 다운로드 API (오류 방지 및 안정화 코드)
app.get(['/api/bugreport/download.json', '/handle/api/bugreport/download.json'], async (req, res) => {
    try {
        console.log('📊 엑셀 다운로드 요청 수신 (ExcelJS)');
        const bugList = getBugList();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('버그리포트_현황');

        // 컬럼 정의
        worksheet.columns = [
            { header: '결함 ID', key: 'bugId', width: 18 },
            { header: '작성자(테스터)', key: 'reporter', width: 15 },
            { header: '담당자(개발자)', key: 'assignee', width: 15 },
            { header: '조치상태', key: 'status', width: 12 },
            { header: '결함 내용', key: 'comment', width: 35 },
            { header: '개발자 코멘트', key: 'devComment', width: 30 },
            { header: '등록일시', key: 'createdAt', width: 22 },
            { header: '캡쳐이미지', key: 'image', width: 22 }
        ];

        if (bugList && bugList.length > 0) {
            for (let i = 0; i < bugList.length; i++) {
                const bug = bugList[i];
                const rowIndex = i + 2; // 1행은 헤더

                // 행 데이터 추가
                const row = worksheet.addRow({
                    bugId: bug.bugId || '',
                    reporter: bug.reporter || '',
                    assignee: bug.assignee || '미정',
                    status: bug.status === 'Y' ? '완료' : (bug.status === 'N' ? '접수' : '대기'),
                    comment: bug.comment || '',
                    devComment: bug.devComment || '',
                    createdAt: bug.createdAt || '',
                    image: ''
                });

                // ----------------------------------------------------
                // 🖼️ [핵심] 만능 이미지 파일 경로 찾기 로직
                // ----------------------------------------------------
                // 1. bugId 기반 파일명 생성 (확장자 보장)
                let fileName = bug.bugId ? bug.bugId.toString().trim() : '';
                if (fileName && !fileName.endsWith('.png')) {
                    fileName += '.png';
                }

                // 2. 여러 가지 가능성의 경로를 후보 배열로 생성
                const candidatePaths = [
                    path.join(process.cwd(), 'uploads', fileName), // 가장 표준: project/uploads/20260724171546.png
                ];

                // filePath 필드가 존재하면 해당 값도 정제해서 후보에 추가
                if (bug.filePath) {
                    const cleanPath = bug.filePath.replace(/^[/\\]+/, ''); // 맨 앞 슬래시 제거
                    candidatePaths.push(path.join(process.cwd(), cleanPath));
                    candidatePaths.push(path.join(process.cwd(), 'uploads', path.basename(cleanPath)));
                }

                // 3. 후보 경로 중 실제 파일이 존재하는 첫 번째 경로 선택
                let absoluteImagePath = candidatePaths.find(p => fs.existsSync(p));

                if (absoluteImagePath) {
                    // 행 높이 조절 (이미지가 잘 보이도록)
                    row.height = 70; 

                    const imageId = workbook.addImage({
                        filename: absoluteImagePath,
                        extension: 'png',
                    });

                    // H열 (8번째 컬럼, 0-indexed로 col: 7)에 이미지 추가
                    worksheet.addImage(imageId, {
                        tl: { col: 7, row: rowIndex - 1 },
                        ext: { width: 120, height: 85 }   // 엑셀 셀 내 이미지 폭/높이(px)
                    });
                    
                    console.log(`✅ [${bug.bugId}] 엑셀 내 이미지 매칭 성공:`, absoluteImagePath);
                } else {
                    console.warn(`⚠️ [${bug.bugId}] 엑셀용 이미지 파일을 찾지 못함. 시도했던 경로들:`, candidatePaths);
                }
            }
        }

        // 응답 전송
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="bug_reports.xlsx"');

        await workbook.xlsx.write(res);
        return res.end();

    } catch (err) {
        console.error('❌ 엑셀 생성 중 오류:', err);
        return res.status(500).send('엑셀 파일 생성 실패');
    }
});


// 💡 [추가 1] uploads 및 data 폴더 정적 파일 접근 허용
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/data', express.static(DATA_DIR));

// 💡 2. dist 폴더 정적 서빙 (폴더가 실제로 존재할 때만 등록하여 로컬 에러 방지)
const DIST_DIR = path.join(process.cwd(), 'dist');
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
}

// 💡 API 이외의 GET 요청 처리 (dist/index.html이 있을 때만 전송)
app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
    }

    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('현재 dist 폴더가 없습니다. 로컬 개발 시에는 Vite 개발 서버(npm run dev)를 사용하시거나 npm run build를 실행하세요.');
    }
});
// 서버 실행
app.listen(PORT, () => {
    if (IS_PRODUCTION) {
        console.log(`🚀 [운영/배포 서버] Node.js 서버가 실행 중입니다. (PORT: ${PORT})`);
    } else {
        console.log(`💻 [로컬 개발 환경] Node.js 서버 실행 중: http://localhost:${PORT}`);
    }
});