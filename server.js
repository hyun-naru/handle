import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { imageSize } from 'image-size';

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

// JSON 파일 읽기/쓰기 유틸리티 함수
const saveBugList = (list) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf8');
        return true; // 👈 성공 시 true 반환하도록 추가
    } catch (e) {
        console.error('❌ DB 파일 저장 오류:', e);
        return false;
    }
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
        const { 
            bugId, 
            reporter, 
            loginId, 
            menuPath, 
            comment, 
            devComment, 
            imageData, 
            reopenTargetId, 
            isEdit,   
            isEdited 
        } = req.body;
        let imagePath = '';

        // Base64 이미지 스트링 -> 실제 .png 파일로 저장
        if (imageData && imageData.includes('base64,')) {
            const fileName = bugId.endsWith('.png') ? bugId : `${bugId}.png`;
            const filePath = path.join(UPLOAD_DIR, fileName);
            const base64Data = imageData.split('base64,')[1];
            fs.writeFileSync(filePath, base64Data, 'base64');
            imagePath = `/api/bugreport/image.json?bugId=${fileName}`;
        }

        let bugList = getBugList();
        
        // trim() 및 String 변환으로 공백/타입 차이로 인한 비교 오류 방지
        const targetBugId = String(bugId || '').trim();
        const existingIndex = bugList.findIndex(b => String(b.bugId).trim() === targetBugId);

        // isEdit(boolean/string) 및 isEdited('Y') 완벽 조건 체크
        const isEditMode = isEdit === true || isEdit === 'true' || isEdited === 'Y';

        if (existingIndex !== -1 && isEditMode) {
            // =========================================================
            // 🔄 1. 기존 데이터 덮어쓰기 (UPDATE)
            // =========================================================
            bugList[existingIndex] = {
                ...bugList[existingIndex], // 기존 데이터(createdAt, assignee, status 등 유지)
                loginId: loginId || bugList[existingIndex].loginId,
                menuPath: menuPath || bugList[existingIndex].menuPath,
                comment: comment || bugList[existingIndex].comment,
                devComment: devComment !== undefined ? devComment : bugList[existingIndex].devComment,
                imagePath: imagePath || bugList[existingIndex].imagePath,
                isEdited: 'Y', // 💡 수정됨 배지 표기 플래그 저장!
                updatedAt: new Date().toISOString()
            };

            // 💡 로그를 if 블록 안으로 이동!
            console.log(`🔄 [수정 완료] 버그 ID: ${bugId}, 작성자: ${bugList[existingIndex].reporter}`);

        } else {
            // =========================================================
            // 🆕 2. 신규 데이터 추가 (INSERT)
            // =========================================================
            const newBug = {
                bugId: bugId || `BUG_${Date.now()}`,
                reporter: reporter || '익명',
                assignee: '미정',
                loginId: loginId || '-',
                menuPath: menuPath || '-',
                comment: comment || '',
                devComment: '',
                status: 'N',
                imagePath: imagePath,
                reopenTargetId: reopenTargetId || '',
                isEdited: isEdited || 'N',
                createdAt: new Date().toISOString()
            };

            bugList.push(newBug);
            console.log(`✅ [신규 저장 완료] 버그 ID: ${newBug.bugId}, 작성자: ${newBug.reporter}`);
        }

        // 파일에 최종 저장
        const isSaved = saveBugList(bugList);

        if (isSaved) {
        res.json({ success: true, message: '버그 리포트가 성공적으로 저장되었습니다.' });
        } else {
            res.status(500).json({ success: false, message: '파일 쓰기 실패' });
        }

    } catch (err) {
        console.error('❌ 저장 중 오류 발생:', err);
        res.status(500).json({ success: false, message: '파일 저장 실패' });
    }
});
// 📌 관리자 - 담당 개발자 배정 API (POST)
app.post(['/api/bugreport/assign.json', '/handle/api/bugreport/assign.json'], (req, res) => {
    try {
        const { bugId, assignee, status } = req.body;

        if (!bugId || !assignee) {
            return res.status(400).json({ status: 'fail', message: 'bugId 또는 assignee가 누락되었습니다.' });
        }

        console.log(`👤 담당자 배정 요청 - ID: ${bugId}, 담당자: ${assignee}${status ? `, 상태: ${status}` : ''}`);

        // 1. 기존 버그 리스트 가져오기 (기존 getBugList 함수 사용)
        let bugList = getBugList();

        // 2. 해당 bugId 찾아서 assignee 변경
        let isUpdated = false;
        bugList = bugList.map(bug => {
            if (String(bug.bugId).trim() === String(bugId).trim()) {
                bug.assignee = assignee;
                
                // 💡 프론트엔드에서 status(예: 'N')를 함께 전달했으면 상태도 업데이트
                if (status) {
                    bug.status = status;
                }
                
                isUpdated = true;
            }
            return bug;
        });

        if (!isUpdated) {
            return res.status(404).json({ status: 'fail', message: '해당 결함 ID를 찾을 수 없습니다.' });
        }

        // 3. JSON 파일에 저장 (💡 saveBugList 유틸리티 활용)
        saveBugList(bugList);

        console.log(`✅ [${bugId}] 담당자 배정 완료: ${assignee}${status ? ` (상태: ${status})` : ''}`);
        return res.json({ status: 'success', message: '담당자 정보가 변경되었습니다.' });

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

        const targetId = String(bugId).trim();

        bugList = bugList.map(bug => {
            if (String(bug.bugId || '').trim() === targetId) {
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

        // 3. JSON 파일 저장 (💡 saveBugList 유틸리티 활용)
        saveBugList(bugList);

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

// 📌 이미지 파일 제공 (캡처보기 대응)
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

// PNG 파일 원본 너비, 높이(px) 추출 함수
function getPngDimensions(filePath) {
    const buffer = Buffer.alloc(24);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // PNG 바이너리 헤더 체크 (PNG 시그니처)
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error('Not a valid PNG file');
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}
// 📌 엑셀 다운로드 API (오류 방지 및 안정화 코드)
app.get(['/api/bugreport/download.json', '/handle/api/bugreport/download.json'], async (req, res) => {
    try {
        console.log('📊 엑셀 다운로드 요청 수신 (ExcelJS)');
        const bugList = getBugList();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('버그리포트_현황');
        
        // Target Image Width 지정
        // const TARGET_WIDTH = 560; //가로
        const TARGET_HEIGHT = 400; //세로

        // 📌 헤더 틀 고정 (1행 고정)
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1 }
        ];

        // 컬럼 정의
        worksheet.columns = [
            { header: '결함 ID', key: 'bugId', width: 18 },
            { header: '작성자\n(테스터)', key: 'reporter', width: 15 },
            { header: '담당자\n(개발자)', key: 'assignee', width: 15 },
            { header: '조치상태', key: 'status', width: 15 },
            { header: '로그인 ID', key: 'loginId', width: 15 },
            { header: '메뉴 진입 경로', key: 'menuPath', width: 15 },
            { header: '결함 내용', key: 'comment', width: 60 },
            { header: '개발자 코멘트', key: 'devComment', width: 60 },
            { header: '완료일시', key: 'completedAt', width: 22 },
            { header: '캡쳐이미지', key: 'image', width: 70 } // 💡 캡쳐이미지 컬럼 고정 너비
        ];

        // =========================================================
        // 🎨 헤더(첫 번째 행) 배경색 및 글자 스타일 적용
        // =========================================================
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30; // 헤더 높이 살짝 늘리기
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF203764' } // 짙은 네이비 배경
            };
            cell.font = {
                color: { argb: 'FFFFFFFF' }, // 흰색 글자
                bold: true,
                size: 11
            };
            cell.alignment = { 
                vertical: 'middle', 
                horizontal: 'center' 
            };
        });
                

        if (bugList && bugList.length > 0) {
            for (let i = 0; i < bugList.length; i++) {
                const bug = bugList[i];
                const rowIndex = i + 2; // 1행은 헤더
                
                // ISO 날짜 문자열을 "YYYY-MM-DD HH:mm" 형식으로 변환하는 함수
                function formatDateToMinutes(dateStr) {
                    if (!dateStr || dateStr === '-') return '-';
                    try {
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr; // 유효하지 않은 날짜면 원본 반환

                        // 한국 표준시(KST) 기준 변환이 필요할 경우 타임존 고려
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');

                        return `${year}-${month}-${day} ${hours}:${minutes}`;
                    } catch (e) {
                        return dateStr;
                    }
                }

                // 완료 일시 대상 값 추출
                const rawCompletedDate = bug.status === 'Y' ? (bug.updatedAt || bug.createdAt || '-') : '-';
                
                // 💡 [수정 2] Key 중복 제거 및 각각의 파싱된 필드에 바인딩
                const row = worksheet.addRow({
                    bugId: bug.bugId || '',
                    reporter: bug.reporter || '',
                    assignee: bug.assignee || '미정',
                    status: bug.status === 'Y' ? '완료' : (bug.status === 'N' ? '접수' : '대기'),
                    loginId: bug.loginId || '-',
                    menuPath: bug.menuPath || '-',
                    comment: bug.comment || '',
                    devComment: bug.devComment || '', 
                    completedAt: formatDateToMinutes(rawCompletedDate),
                    image: ''
                });
                // 각 셀에 자동 줄바꿈 및 정렬 적용
                row.eachCell((cell, colNumber) => {
                    cell.alignment = { 
                        wrapText: true,    // 텍스트 자동 줄바꿈
                        vertical: 'middle' // 세로 가운데 정렬
                    };
                    // =========================================================
                    // 🎨 특정 조건(조치상태)에 맞춰 셀 배경색 넣기
                    // =========================================================
                    // 4번째 컬럼 (조치상태) 배경색 적용
                    if (colNumber === 4) {
                        if (cell.value === '완료') {
                            cell.fill = { 
                                type: 'pattern', 
                                pattern: 'solid', 
                                fgColor: { argb: 'FFE2EFDA' } // 연한 녹색
                            };
                        } else if (cell.value === '접수') {
                            cell.fill = { 
                                type: 'pattern', 
                                pattern: 'solid', 
                                fgColor: { argb: 'FFFCE4D6' } // 연한 주황색
                            };
                        }
                    }
                });

                // ----------------------------------------------------
                // 🖼️ [핵심] 만능 이미지 파일 경로 찾기 로직
                // ----------------------------------------------------
                // 1. bugId 기반 파일명 생성 (확장자 보장)
                let fileName = String(bug.bugId || '').trim();
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
                    //let calculatedHeight = 200; // 기본 세로값 (오류 시 대체)
                    let calculatedWidth = 500; // 기본 가로값 (오류 발생 시 대체)

                    try {
                        // 🖼️ 1. PNG 바이너리에서 원본 크기 추출
                        const dimensions = getPngDimensions(absoluteImagePath);
                        const originalWidth = dimensions.width || 1;
                        const originalHeight = dimensions.height || 1;

                        // 🖼️ 2. 가로 기준(TARGET_WIDTH)에 맞춰 비율 자동 계산
                        // calculatedHeight = Math.round((TARGET_WIDTH / originalWidth) * originalHeight);
                        // 🖼️ 3. 세로 기준(TARGET_HEIGHT)에 맞춰 가로 너비 자동 계산
                        calculatedWidth = Math.round((TARGET_HEIGHT / originalHeight) * originalWidth);
                    } catch (imgErr) {
                        console.warn(`⚠️ [${bug.bugId}] 이미지 해상도 파싱 실패, 기본 크기 적용:`, imgErr.message);
                    }

                    // 🖼️ 3. 행 높이를 계산된 이미지 높이에 맞춰 동적 조절
                    // row.height = Math.max(calculatedHeight * 0.75 + 15, 40); //가로
                    // 🖼️ 4. 행 높이를 지정한 세로 높이에 맞춰 고정 (pt 단위 변환 + 여백)
                    row.height = TARGET_HEIGHT * 0.75 + 15;
                    // 🖼️ 5. 이미지 가로 폭에 맞춰 H열 너비 동적 조절 (px ➡️ excel column width)
                    const imageCol = worksheet.getColumn(10); // 10번째 컬럼 (image)
                    const requiredColWidth = Math.round(calculatedWidth / 7) + 3;
                    if ((imageCol.width || 0) < requiredColWidth) {
                        imageCol.width = requiredColWidth;
                    }
                    const imageId = workbook.addImage({
                        filename: absoluteImagePath,
                        extension: 'png',
                    });

                    // 🖼️ 4. 비율대로 이미지 삽입
                    worksheet.addImage(imageId, {
                        tl: { col: 9, row: rowIndex - 1 },
                        //ext: { width: TARGET_WIDTH, height: calculatedHeight } //가로
                        ext: { width: calculatedWidth, height: TARGET_HEIGHT } //세로
                    });
                    //console.log(`✅ [${bug.bugId}] 이미지 비율 계산 성공 (높이: ${calculatedHeight}px)`);
                    console.log(`✅ [${bug.bugId}] 이미지 세로 기준 계산 성공 (가로: ${calculatedWidth}px, 세로: ${TARGET_HEIGHT}px)`);
                    console.log(`✅ [${bug.bugId}] 엑셀 내 이미지 매칭 성공:`, absoluteImagePath);
                } else {
                    row.height = 30;
                    console.warn(`⚠️ [${bug.bugId}] 엑셀용 이미지 파일을 찾지 못함. 시도했던 경로들:`, candidatePaths);
                }
            }
            // 루프가 완전히 끝난 뒤 단 1회만 컬럼 너비 자동 계산 처리
            worksheet.columns.forEach(column => {
                // 이미지 컬럼(image)은 너비 계산에서 제외
                if (column.key === 'image') return;

                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                // 최소 너비 12 설정 (한글 고려)
                column.width = Math.max(maxLength + 4, 12);
            });
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


// [신규 추가] 버그 리포트 삭제 API (기록 완전히 삭제)
app.post(['/api/bugreport/delete.json', '/handle/api/bugreport/delete.json'], (req, res) => {
    try {
        const { bugId } = req.body;

        if (!bugId) {
            return res.status(400).json({ status: 'error', message: 'bugId가 필요합니다.' });
        }

        let bugList = getBugList();
        const initialLength = bugList.length;
        
        // 해당 bugId를 제외한 목록으로 필터링
        const targetId = String(bugId || '').trim();
        bugList = bugList.filter(bug => String(bug.bugId || '').trim() !== targetId);

        if (bugList.length === initialLength) {
            return res.status(404).json({ status: 'error', message: '해당 버그 리포트를 찾을 수 없습니다.' });
        }

        // 💡 saveBugList 실행 및 저장 성공 여부 검사
        if (saveBugList(bugList)) {
            // 💡 uploadDir -> UPLOAD_DIR 변수명 수정
            const fileName = targetId.endsWith('.png') ? targetId : `${targetId}.png`;
            const imagePath = path.join(UPLOAD_DIR, fileName);
            if (fs.existsSync(imagePath)) {
                try { 
                    fs.unlinkSync(imagePath); 
                    console.log(`🗑️ [${targetId}] 이미지 파일 삭제 완료`);
                } catch (e) { 
                    console.error('이미지 삭제 실패:', e); 
                }
            }

            return res.json({ status: 'success', message: '결함이 완전히 삭제되었습니다.' });
        } else {
            return res.status(500).json({ status: 'error', message: '파일 저장 중 오류가 발생했습니다.' });
        }
    } catch (err) {
        console.error('❌ 삭제 처리 중 서버 오류:', err);
        return res.status(500).json({ status: 'error', message: '서버 처리 중 오류가 발생했습니다.' });
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
    if (req.path.startsWith('/api') || req.path.startsWith('/handle') || req.path.startsWith('/uploads')) {
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