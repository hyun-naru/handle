import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000; 

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🌟 파일 DB 경로 설정
const BUG_LIST_FILE = path.join(__dirname, 'bug_list_db.json');
const IMAGE_STORAGE_FILE = path.join(__dirname, 'image_storage_db.json');

// 실제 데이터가 메모리에 상주할 변수
let mockBugList = [];
let imageStorage = {};

// 🌟 [최초 실행 로직] 크래시 방지 보완
try {
    if (fs.existsSync(BUG_LIST_FILE)) {
        const bugData = fs.readFileSync(BUG_LIST_FILE, 'utf-8').trim();
        // 파일 내용이 비어있지 않을 때만 파싱 처리
        mockBugList = bugData ? JSON.parse(bugData) : [];
        console.log(`💾 [로드 완료] 기존 버그 리포트 ${mockBugList.length}건을 파일에서 불러왔습니다.`);
    } else {
        fs.writeFileSync(BUG_LIST_FILE, '[]', 'utf-8');
    }

    if (fs.existsSync(IMAGE_STORAGE_FILE)) {
        const imageData = fs.readFileSync(IMAGE_STORAGE_FILE, 'utf-8').trim();
        imageStorage = imageData ? JSON.parse(imageData) : {};
        console.log(`💾 [로드 완료] 기존 이미지 스토리지 데이터를 파일에서 불러왔습니다.`);
    } else {
        fs.writeFileSync(IMAGE_STORAGE_FILE, '{}', 'utf-8');
    }
} catch (err) {
    console.error("🚨 파일 DB 로드 중 오류 발생 (빈 값으로 안전 초기화):", err);
    mockBugList = [];
    imageStorage = {};
}

// 🌟 데이터를 파일에 동기화(저장)하는 안전 함수
function saveToDisk() {
    try {
        fs.writeFileSync(BUG_LIST_FILE, JSON.stringify(mockBugList, null, 2), 'utf-8');
        fs.writeFileSync(IMAGE_STORAGE_FILE, JSON.stringify(imageStorage, null, 2), 'utf-8');
        console.log("💾 [동기화 완료] 데이터가 성공적으로 파일에 백업되었습니다.");
    } catch (err) {
        console.error("🚨 파일 파일 저장 실패:", err);
    }
}


// [1] 버그 목록 조회 (GET)
app.get('/api/bugreport/list.json', (req, res) => {
    try {
        console.log("=== 📊 프론트엔드 목록 조회(GET) ===");
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.status(200).json(mockBugList);
    } catch (error) {
        console.error("목록 조회 중 에러:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// [2] 버그 리포트 저장 (POST)
app.post('/api/bugreport/save.json', (req, res) => {
    try {
        console.log("=== 💾 버그 리포트 신규 등록(POST) ===");
        // 프론트엔드 시스템 규격에 따라 날짜+시간 기반의 bugId가 body로 전달되거나 없으면 서버에서 생성합니다.
        const { reporter, comment, imageData, bugId } = req.body;
        
        // 프론트엔드가 보낸 날짜시간 ID가 있으면 쓰고, 없으면 서버 타임스탬프 생성
        let finalBugId = bugId;
        if (!finalBugId) {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const koreanTime = new Date(now.getTime() - offset);
            finalBugId = koreanTime.toISOString().replace(/[^0-9]/g, "").slice(0, 12); // YYYYMMDDHHmm
        }
        
        // 💡 추출된 날짜+시간 ID를 Key로 삼아 이미지 저장
        if (imageData) {
            imageStorage[finalBugId] = imageData;
            console.log(`📸 [성공] ID [${finalBugId}]의 이미지 등록 완료. (길이: ${imageData.length})`);
        }

        const newBug = {
            bugId: finalBugId,
            reporter: reporter || '익명',
            comment: comment,
            assignee: '미정',
            status: 'N',
            devComment: '',
            imagePath: `/api/bugreport/images/${finalBugId}.png`
        };
        
        mockBugList.push(newBug);
        
        // 🌟 하드디스크 파일에 영구 저장 트리거
        saveToDisk();

        return res.status(200).json({ success: true, status: "success", message: "성공적으로 수신했습니다." });
    } catch (error) {
        console.error("저장 중 오류:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// [3] 이미지 보기 요청 처리 (GET)
app.get('/api/bugreport/image.json', (req, res) => {
    let bugId = req.query.bugId;
    
    if (bugId) {
        bugId = bugId.replace('.png', '');
    }
    
    console.log(`=== 🖼️ 이미지 다운로드 요청 들어옴 [ID: ${bugId}] ===`);

    let base64Data = imageStorage[bugId];

    if (!base64Data) {
        console.log(`❌ [경고] 저장소에 ID [${bugId}]에 매칭되는 실제 이미지가 없습니다.`);
        base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }

    try {
        const pureBase64 = base64Data.split(',')[1];
        const imgBuffer = Buffer.from(pureBase64, 'base64');

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': imgBuffer.length,
            'Cache-Control': 'no-cache'
        });
        return res.end(imgBuffer);
    } catch (err) {
        console.error("이미지 디코딩 에러:", err);
        return res.status(500).send("Image Error");
    }
});
// [4] 개발자 상태 및 코멘트 업데이트 (POST)
app.post('/api/bugreport/update.json', (req, res) => {
    const { bugId, status, devComment } = req.body;
    const bug = mockBugList.find(b => b.bugId.toString() === bugId.toString());
    if (bug) {
        if (status !== undefined) bug.status = status;
        if (devComment !== undefined) bug.devComment = devComment;
        
        // 🌟 데이터가 바뀔 때마다 파일에 동기화 저장
        saveToDisk();
        
        return res.status(200).json({ status: "success" });
    }
    return res.status(404).json({ status: "fail" });
});

// [5] 담당 개발자 배정 (POST)
app.post('/api/bugreport/assign.json', (req, res) => {
    const { bugId, assignee } = req.body;
    const bug = mockBugList.find(b => b.bugId.toString() === bugId.toString());
    if (bug) {
        bug.assignee = assignee;
        
        // 🌟 담당자 지정 변경 시 파일에 동기화 저장
        saveToDisk();
        
        return res.status(200).json({ status: "success" });
    }
    return res.status(404).json({ status: "fail" });
});


// [7] 엑셀 다운로드 (GET) 🌟 내용이 정상적으로 담기고 열리는 코드로 교체
app.get('/api/bugreport/download.json', async (req, res) => {
    console.log("=== 📥 버그리포트 엑셀 다운로드 요청 ===");
    
    try {
        // 1. 새 엑셀 파일(워크북)과 시트 만들기
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('결함 현황판');

        // 2. 엑셀 상단 헤더 열(Column) 구조 정의
        worksheet.columns = [
            { header: '버그 ID', key: 'bugId', width: 18 },
            { header: '제보자', key: 'reporter', width: 12 },
            { header: '결함 내용 (아이디 / 경로 / 내용)', key: 'comment', width: 60 },
            { header: '담당 개발자', key: 'assignee', width: 15 },
            { header: '상태', key: 'statusText', width: 15 },
            { header: '개발자 코멘트', key: 'devComment', width: 60 },
        ];
        // 임시 텍스트 매핑용 객체 (프론트엔드 배열과 매칭)
        const statusMap = {
            '': '대기중',
            'N': 'N (접수)',
            'Y': 'Y (조치완료)',
            'R': 'R (재결함)',
            'CLOSED': '종결',
            'CANCEL': '취소'
        };
        // 3. 현재 메모리 배열(mockBugList)에 누적된 진짜 버그 데이터를 행으로 추가
        mockBugList.forEach(bug => {// 영문 코드(N, Y 등)를 사람이 읽기 쉬운 한글 텍스트로 치환
            const korStatus = statusMap[bug.status] || bug.status || '대기중';
            worksheet.addRow({
                bugId: bug.bugId,
                reporter: bug.reporter,
                comment: bug.comment, // 앞서 앞단에서 합쳐준 로그인ID, 경로, 텍스트가 여기 드갑니다.
                assignee: bug.assignee || '미지정',
                statusText: korStatus,
                devComment: bug.devComment || ''
            });
        });

        // 4. 셀 내부 텍스트 자동 줄바꿈 및 정렬 스타일 입히기 (가독성 확보)
        worksheet.eachRow((row, rowNumber) => {
            // 헤더 행(1번)은 배경색과 볼드체 처리
            if (rowNumber === 1) {
                row.font = { bold: true };
            }
            row.eachCell((cell) => {
                cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
            });
        });

        // 5. 브라우저가 정식 엑셀(.xlsx) 파일 스트림으로 인식하게끔 응답 헤더 설정
        res.setHeader('Content-Disposition', 'attachment; filename=BugReport_List.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // 6. 엑셀 파일 바이너리 작성 후 브라우저로 전송
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("엑셀 다운로드 처리 에러:", error);
        res.status(500).send("엑셀 파일 생성 실패");
    }
});
// [8] 단위테스트 결과서 생성 (POST)
app.post('/test/generateExcelReport.json', (req, res) => {
    console.log("=== 📝 단위테스트 결과서 생성 요청 ===");
    res.setHeader('Content-Disposition', 'attachment; filename=UnitTest_Report.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from('Mock UnitTest Excel Data'));
});

// 서버 기동
app.listen(PORT, () => {
    console.log(`🚀 백엔드 Mock 서버가 구동되었습니다: http://localhost:${PORT}`);
});