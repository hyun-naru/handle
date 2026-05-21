// 전역 변수 설정 및 명단 배열화 (실제 운영 데이터 명단으로 교체하여 사용하세요)
let canvasbug, ctx;
let isDrawing = false;
let startX, startY;
let currentTool = 'rect'; // 'rect' or 'text'
let bgImageBase64 = '';

// 문자열 대신 데이터 관리가 용이하도록 배열로 초기화합니다.
let testerList = ['김테스트', '이검증', '박버그', '최수정'];
let developerList = ['홍길동', '이순신', '강감찬', '김연희'];
let adminList = ['김민준'];

let savedImageData = null;
let reopenTargetId = null; // 재결함
const SESSION_KEY_NAME = 'BUG_REPORT_USER_NAME';
const SESSION_KEY_ROLE = 'BUG_REPORT_USER_ROLE';

// 스크립트 로드 시 초기화
window.addEventListener('load', function() {
    injectHtml();
    bindEvents();
    checkFakeLogin(); // 새로고침해도 상단 바 유지되도록 체크
});

/**
 * 1. 전체 UI HTML 주입 (로그인, 그림판, 네비게이션바, 현황판)
 */
function injectHtml() {
    // ① 가상 로그인 모달
    const loginModal = `
        <div id="bugLoginModal" class="modal">
            <div class="bug-modal-content">
                <button type="button" id="btnCloseBugLogin" class="bug-close-btn"></button>
                <h3>가상 로그인</h3>
                <select id="bugUserRole">
                    <option value="tester">🔍 테스터 (버그 등록)</option>
                    <option value="developer">💻 개발자 (엑셀 다운로드 & 조치)</option>
                    <option value="admin">👑 관리자 (담당자 배정 현황판)</option>
                </select>
                <select id="bugUserName">
                    <option value="">소속을 선택하면 명단이 나옵니다.</option>
                </select>
                <button id="btnBugLoginSubmit">입장하기</button>
            </div>
        </div>
    `;

    // ② 상단 네비게이션 바
    const topNavHtml = `
        <div id="bugTopNav" class="bug-top-nav">
            <div id="bugUserInfo" class="bug-user-badge"></div>
            <button id="btnBugDashboard" class="bug-nav-btn">📊 현황판</button>
            <button id="btnBugLogout" class="bug-nav-btn logout">🔄 로그아웃</button>
            <button class="bug-nav-btn" onclick="downloadExcelReport();">엑셀다운로드</button>
        </div>
    `;

    // ③ 그림판 모달
    const paintModal = `
        <div id="bugPaintModal" class="modal">
            <div class="modal-content">
                <div class="bug-paint-toolbar" style="padding:10px; background:#f1f2f6; border-bottom:1px solid #ddd; display:flex; gap:10px; align-items:center;">
                    <button id="btnPaintToolRect" style="padding:8px; cursor:pointer; background:#fff; border:2px solid #e84118;">🟥 박스 그리기</button>
                    <button id="btnPaintToolText" style="padding:8px; cursor:pointer; background:#fff; border:1px solid #ccc;">🔤 텍스트 입력</button>
                    <button id="btnPaintToolClear" style="padding:8px; cursor:pointer;">🧹 초기화</button>
                    <div style="flex-grow:1;"></div>
                    <button id="btnPaintSave" class="bug-paint-save-btn">💾 버그 리포트 전송</button>
                    <button id="btnClosePaintModal" style="padding:8px; cursor:pointer;">❌ 취소</button>
                </div>
                <div style="padding:10px; border-bottom:1px solid #ddd;">
                    <textarea id="bugFinalComment" placeholder="결함내용을 작성해 주세요(엔터가능)" style="width:100%; height:60px; padding:10px; box-sizing:border-box;">로그인 아이디 : \n메뉴 진입 경로 :\n액션 순서 및 결함 내용 :</textarea>
                </div>
                <div style="flex-grow:1; overflow:auto; background:#ccc; display:flex; justify-content:center; align-items:flex-start; padding:20px;">
                    <canvas id="bugCanvas" style="background:white; box-shadow:0 0 10px rgba(0,0,0,0.5); cursor:crosshair;"></canvas>
                </div>
            </div>
        </div>
    `;

    // ④ 통합 버그 리포트 대시보드
    const dashboardModal = `
        <div id="bugAdminModal" class="modal">
            <div class="modal-content bug-admin-content">
                <button type="button" id="btnCloseAdminModal" class="bug-close-btn"></button>
                <h2>📊 버그 리포트 통합 대시보드</h2>
                <div style="overflow-y: auto; height: calc(80vh - 80px);">
                    <table class="bug-admin-table" style="width:100%; border-collapse:collapse; margin-top:15px;">
                        <colgroup>
                            <col style="width:8%;" />
                            <col style="width:12%;" />
                            <col style="width:25%;" />
                            <col style="width:12%;" />
                            <col style="width:13%;" />
                            <col style="width:20%;" />
                            <col style="width:10%;" />
                        </colgroup>
                        <thead style="background:#f1f2f6;">
                            <tr>
                                <th>ID</th>
                                <th>테스터</th>
                                <th>결함 코멘트</th>
                                <th>담당자</th>
                                <th>상태</th>
                                <th>개발자 코멘트</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody id="bugAdminTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const imageModal = `
        <div id="bugImageModal" style="display:none; position:fixed; z-index:10000003; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.9); text-align:center; overflow:auto;">
            <button type="button" onclick="hideModal('bugImageModal')" class="bug-close-btn"></button>
            <img id="bugPreviewImg" style="max-width:98%; margin-top:50px; border:5px solid white; box-shadow:0 0 20px rgba(0,0,0,0.5);">
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loginModal + topNavHtml + paintModal + dashboardModal + imageModal);

    canvasbug = document.getElementById('bugCanvas');
    ctx = canvasbug.getContext('2d');
    ctx.strokeStyle = '#e84118';
    ctx.lineWidth = 3;
    ctx.font = '20px Arial';
    ctx.fillStyle = '#e84118';
}

/**
 * 2. 이벤트 바인딩 연결
 */
function bindEvents() {
    const mainBtn = document.getElementById('btnBugReportMain');
    if (mainBtn) mainBtn.addEventListener('click', handleMainButtonClick);

    document.getElementById('btnCloseBugLogin').addEventListener('click', () => hideModal('bugLoginModal'));
    document.getElementById('btnBugLoginSubmit').addEventListener('click', doFakeLogin);

    $(document).on('change', '#bugUserRole', function() {
        const role = $(this).val();
        const $nameSelect = $('#bugUserName');
        
        $nameSelect.empty().append('<option value="">이름을 선택하세요</option>');
        
        let targetList = [];
        if (role === 'tester') targetList = testerList;
        else if (role === 'developer') targetList = developerList;
        else if (role === 'admin') targetList = adminList;
        
        targetList.forEach(name => {
            $nameSelect.append(`<option value="${name}">${name}</option>`);
        });
    });

    $('#bugUserRole').trigger('change');

    const btnDashboard = document.getElementById('btnBugDashboard');
    if (btnDashboard) btnDashboard.addEventListener('click', openUnifiedDashboard);

    const topLogoutBtn = document.getElementById('btnBugLogout');
    if (topLogoutBtn) topLogoutBtn.addEventListener('click', doLogout);

    document.getElementById('btnCloseAdminModal').addEventListener('click', () => hideModal('bugAdminModal'));
    document.getElementById('btnClosePaintModal').addEventListener('click', () => hideModal('bugPaintModal'));
    document.getElementById('btnPaintToolClear').addEventListener('click', () => initCanvasDraw(bgImageBase64));
    document.getElementById('btnPaintSave').addEventListener('click', saveAndReportBug);

    document.getElementById('btnPaintToolRect').addEventListener('click', function () { setTool('rect', this); });
    document.getElementById('btnPaintToolText').addEventListener('click', function () { setTool('text', this); });

    canvasbug.addEventListener('mousedown', startDrawing);
    canvasbug.addEventListener('mousemove', draw);
    canvasbug.addEventListener('mouseup', stopDrawing);
    canvasbug.addEventListener('mouseout', stopDrawing);
}

/**
 * 3. 메인 기능 흐름 제어
 */
function handleMainButtonClick() {
    const userInfo = checkFakeLogin();
    if (!userInfo) {
        showModal('bugLoginModal');
        return;
    }

    if (userInfo.userRole === 'tester') {
        startBugReportProcess();
    } else if (userInfo.userRole === 'developer') {
        downloadExcelReport();
    } else if (userInfo.userRole === 'admin') {
        openUnifiedDashboard();
    }
}

/**
 * 4. 로그인 / 로그아웃 관리
 */
function checkFakeLogin() {
    const userName = sessionStorage.getItem(SESSION_KEY_NAME);
    const userRole = sessionStorage.getItem(SESSION_KEY_ROLE);

    if (userName && userRole) {
        let roleName = userRole === 'tester' ? '테스터' : (userRole === 'developer' ? '개발자' : '관리자');
        document.getElementById('bugUserInfo').innerText = `🪪 ${roleName}: ${userName}`;
        document.getElementById('bugTopNav').style.display = 'flex';
        return { userName, userRole };
    }
    document.getElementById('bugTopNav').style.display = 'none';
    return null;
}

function doFakeLogin() {
    const role = document.getElementById('bugUserRole').value;
    const name = document.getElementById('bugUserName').value;

    if (!name) { 
        alert('본인의 이름을 목록에서 선택해주세요.'); 
        return; 
    }

    if (role === 'tester') {
        
        $.ajax({
            url: '/api/bugreport/list.json', 
            type: 'GET', 
            dataType: 'json',
            success: function (list) {
                const solvedBugs = list.filter(b => b.reporter === name && b.status === 'Y');
                if (solvedBugs.length > 0) {
                    alert(`🎉 [알림] ${name}님이 등록하신 결함 중 ${solvedBugs.length}건이 조치 완료되었습니다!\n우측 상단 [📊 현황판]을 클릭해 개발자 코멘트를 확인하세요.`);
                } else {
                    alert(`${name}님 환영합니다! 버그리포팅 버튼을 다시 눌러 캡처를 시작하세요.`);
                }
                executeLoginSuccess(role, name);
            },
            error: function() {
                executeLoginSuccess(role, name);
            }
        });
    } else {
        let roleName = role === 'developer' ? '개발자' : '관리자';
        alert(`${name}님(${roleName}) 환영합니다!`);
        executeLoginSuccess(role, name);
    }
}

function executeLoginSuccess(role, name) {
    sessionStorage.setItem(SESSION_KEY_ROLE, role);
    sessionStorage.setItem(SESSION_KEY_NAME, name);
    hideModal('bugLoginModal');
    checkFakeLogin();
}

function doLogout() {
    sessionStorage.removeItem(SESSION_KEY_NAME);
    sessionStorage.removeItem(SESSION_KEY_ROLE);
    const topNav = document.getElementById('bugTopNav');
    if (topNav) topNav.style.display = 'none';
    alert('로그아웃 되었습니다.');
}


/**
 * 5. 현황판 대시보드 (역할별 맞춤 렌더링)
 */
function openUnifiedDashboard() {
    const userInfo = checkFakeLogin();
    if (!userInfo) return;

    $.ajax({
        url: '/api/bugreport/list.json', type: 'GET', dataType: 'json',
        success: function (list) {
            const tbody = document.getElementById('bugAdminTableBody');
            tbody.innerHTML = '';
            // console.log(list)
            // 데이터 필터링 (테스터=내것만, 개발자=배정된것만, 관리자=전부)
            let filteredList = list;
            if (userInfo.userRole === 'tester') {
                filteredList = list.filter(b => b.reporter === userInfo.userName);
            } else if (userInfo.userRole === 'developer') {
                filteredList = list.filter(b => b.assignee === userInfo.userName);
            }

            if (filteredList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">조회된 버그 리포트가 없습니다.</td></tr>`;
                showModal('bugAdminModal');
                return;
            }

            // 역순(최신순) 정렬
            filteredList.reverse().forEach(bug => {
                const tr = document.createElement('tr');

                // 공통 텍스트 렌더링 (따옴표 등 이스케이프 방지)
                const safeComment = bug.comment ? bug.comment.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                const safeDevComment = bug.devComment ? bug.devComment.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                
                let html = '';
                // 테스터 , 관리자는 취소, 종결된 로운 안보임
                if (userInfo.userRole === 'tester' && bug.status !== 'CLOSED' && bug.status !== 'CANCEL') {
                    html = `
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.bugId.replace('BUG_', '')}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.reporter}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:left; font-size:13px;white-space:pre-wrap;">${safeComment}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                        <span style="color:${bug.assignee === '미정' ? 'red' : 'blue'}; font-weight:bold;">${bug.assignee}</span>
                    </td>
                `;
                } else if (userInfo.userRole === 'admin') {
                    html = `
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.bugId.replace('BUG_', '')}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.reporter}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:left; font-size:13px;white-space:pre-wrap;">${safeComment}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                        <span style="color:${bug.assignee === '미정' ? 'red' : 'blue'}; font-weight:bold;">${bug.assignee}</span>
                    </td>
                `;
                }
                //개발자는 취소, 종결, 처리완료 결함은 보이지 않음
                if (userInfo.userRole === 'developer' && bug.status !== 'Y' && bug.status !== 'CLOSED' && bug.status !== 'CANCEL') {
                    html = `
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.bugId.replace('BUG_', '')}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">${bug.reporter}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:left; font-size:13px;white-space:pre-wrap;">${safeComment}</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                        <span style="color:${bug.assignee === '미정' ? 'red' : 'blue'}; font-weight:bold;">${bug.assignee}</span>
                    </td>
                `;
                }
                let actionHtml = ` <button class="bug-nav-btn" style="background-color:#f39c12 !important; margin-bottom:2px;" onclick="viewBugImage('${bug.imagePath}')">캡쳐보기</button>`;
                // 🌟 역할별 맞춤 컬럼 렌더링
                if (userInfo.userRole === 'developer') {
                    // 개발자 전용 액션 (상태 변경 및 코멘트 작성)
                    // <option value="Y" ${bug.status === 'CLOSED' ? 'selected' : ''}>종결됨</option>
                    //             <option value="Y" ${bug.status === 'CANCEL' ? 'selected' : ''}>취소됨</option>
                    if (bug.status !== 'Y' && bug.status !== 'CLOSED' && bug.status !== 'CANCEL') {
                        html += `
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                            <select id="status_${bug.bugId}" style="padding:5px;">
                                <option value="N" ${bug.status === 'N' ? 'selected' : ''}>N (접수)</option>
                                <option value="Y" ${bug.status === 'Y' ? 'selected' : ''}>Y (완료)</option>
                                <option value="Y" ${bug.status === 'R' ? 'selected' : ''}>R (재결함)</option>
                                
                            </select>
                        </td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                            <input type="text" id="devCom_${bug.bugId}" value="${safeDevComment}" style="width:95%; padding:6px; box-sizing:border-box;">
                        </td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">
                            ${actionHtml}<br>
                            <button class="bug-nav-btn" onclick="updateBugByDev('${bug.bugId}')">저장</button>
                        </td>
                    `;
                    }
                } else {
                    // 테스터 & 관리자 뷰 (읽기 전용 상태/코멘트, 단 관리자는 배정 가능)
                    let statusBadge = '<span style="color:gray;font-weight:bold;">N (대기중)</span>';
                    if (bug.status === 'Y') statusBadge = '<span style="color:green;font-weight:bold;">Y (조치완료)</span>';
                    if (bug.status === 'R') statusBadge = '<span style="color:red;font-weight:bold;">R (재결함)</span>';
                    if (bug.status === 'CLOSED') statusBadge = '<span style="color:red;font-weight:bold;">종결</span>';
                    if (bug.status === 'CANCEL') statusBadge = '<span style="color:red;font-weight:bold;">취소</span>';

                    let actionBtn = '-';
                    if (userInfo.userRole === 'admin') {
                        actionBtn = `<button class="bug-nav-btn" style="background-color:#9b59b6!important;" onclick="assignDeveloperToBug('${bug.bugId}', '${bug.assignee}')">담당 배정</button>`;
                    }
                    if (userInfo.userRole === 'tester' && bug.status === 'Y') {
                        actionBtn += `<br><button class="bug-nav-btn" style="background-color:#e74c3c !important; margin-top:2px;" onclick="startReopenProcess('${bug.bugId}')">재결함캡쳐</button> `;
                        actionBtn += `<br><button class="bug-nav-btn" style="background-color:#16a087 !important; margin-top:2px;" onclick="updateBugStatus('${bug.bugId}','CANCEL')">결함취소</button> `;
                        actionBtn += `<br><button class="bug-nav-btn" style="background-color:#236bd9 !important; margin-top:2px;" onclick="updateBugStatus('${bug.bugId}','CLOSED')">결함종결</button> `;

                    }
                    if (userInfo.userRole === 'tester' && bug.status !== 'CLOSED' && bug.status !== 'CANCEL') {
                        html += `
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">${statusBadge}</td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:left; color:#d35400; font-weight:bold;">${safeDevComment}</td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">${actionHtml}<br>${actionBtn}</td>
                    `;
                    } else if (userInfo.userRole === 'admin') {
                        html += `
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">${statusBadge}</td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:left; color:#d35400; font-weight:bold;">${safeDevComment}</td>
                        <td style="border:1px solid #ddd; padding:10px; text-align:center;">${actionHtml}<br>${actionBtn}</td>
                    `;
                    }

                }
                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
            showModal('bugAdminModal');
        },
        error: function () { alert('현황판 데이터를 불러오는데 실패했습니다.'); }
    });
}

/**
 * 6. 백엔드 통신 API 함수들 (저장, 다운로드, 업데이트, 담당자배정)
 */

// 개발자: 엑셀 파일 다운로드 (window.location.href 사용)
function downloadExcelReport() {
    if (!confirm('지금까지 접수된 버그 현황을 엑셀로 다운로드 하시겠습니까?')) return;
    window.location.href = '/api/bugreport/download.json';
}

// 개발자: 결함 상태 & 코멘트 업데이트
window.updateBugByDev = function (bugId) {
    const status = document.getElementById(`status_${bugId}`).value;
    const devComment = document.getElementById(`devCom_${bugId}`).value.trim();

    $.ajax({
        url: '/api/bugreport/update.json', type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId, status: status, devComment: devComment }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success') {
                alert('조치 상태와 코멘트가 저장되었습니다!');
                openUnifiedDashboard(); // 리프레시
            } else { alert('저장 실패: ' + res.message); }
        }
    });
};
window.updateBugStatus = function (bugId, newStatus) {
    const statusText = newStatus === 'CLOSED' ? '종결' : '취소';
    if (!confirm(`정말 이 결함을 [${statusText}] 처리하시겠습니까?`)) { return; }
    $.ajax({
        url: '/api/bugreport/updateForTester.json', type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId, status: newStatus }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success') {
                alert(`결함이 ${statusText} 처리 되었습니다.`);
                openUnifiedDashboard(); // 리프레시
            } else { alert('저장 실패: ' + res.message); }
        }
    });
}
// 관리자: 담당자 배정
window.assignDeveloperToBug = function (bugId, currentAssignee) {
    const devName = prompt(`담당 개발자 이름을 입력하세요:`, currentAssignee === '미정' ? '' : currentAssignee);
    if (!devName || devName.trim() === '') return;

    $.ajax({
        url: '/api/bugreport/assign.json', type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId, assignee: devName.trim() }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success') {
                alert(`${devName} 개발자가 배정되었습니다!`);
                openUnifiedDashboard(); // 리프레시
            } else { alert('배정 실패: ' + res.message); }
        }
    });
};

//캡쳐이미지 보기 
window.viewBugImage = function (originalPath) {
    if (!originalPath) { alert('첨부된 이미지가 없습니다.'); return; }
    const imgTag = document.getElementById('bugPreviewImg');

    // imgTag.src = originalPath;

    const pathParts = originalPath.split('/');
    const bugId = pathParts[4];
    const targetFile = bugId;
    imgTag.src = '/api/bugreport/image.json?bugId=' + encodeURIComponent(targetFile);
    showModal('bugImageModal');
}

//재결함 캡쳐
window.startReopenProcess = function (bugId) {
    if (!confirm('이 결함이 조치되지 않아 신규 캡쳐를 진행하시겠습니까?')) return;
    reopenTargetId = bugId;
    hideModal('bugAdminModal');
    startBugReportProcess();
}

// 테스터: 버그 저장 전송 로직 (다중클릭 방지 적용)
function saveAndReportBug() {
    // const comment = prompt('서버 엑셀에 기록될 최종 결함 코멘트를 입력하세요:');

    const commentBox = document.getElementById('bugFinalComment');
    const comment = commentBox.value.trim();
    let finalComment = comment;
    if (reopenTargetId) {
        finalComment = `[재결함 : ${reopenTargetId}]` + comment;
    }
    if (!comment) { alert('코멘트를 입력해야 저장됩니다.'); return; }
    if (!confirm('결함을 서버로 전송하시겠습니까?')) return;

    // 다중클릭 방지
    const saveBtn = document.getElementById('btnPaintSave');
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 전송 중...';

    const editedImageBase64 = canvasbug.toDataURL('image/png');
    const userInfo = checkFakeLogin();

    $.ajax({
        url: '/api/bugreport/save.json', type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({
            reporterName: userInfo.userName,
            comment: finalComment,
            imageData: editedImageBase64
        }),
        dataType: 'json',
        success: function (data) {
            if (data.status === 'success') {
                alert(`전송 성공! (ID: ${data.bugId})\n상단 현황판에서 접수 내역을 확인하세요.`);
                commentBox.value = '로그인 아이디 : \n메뉴 진입 경로 : \n액션 순서 및 결함 내용 : ';
                reopenTargetId = '';
                hideModal('bugPaintModal');
            } else { alert(`전송 실패: ${data.message}`); }
        },
        error: function (xhr, status, error) { alert('전송 중 통신 오류가 발생했습니다.'); },
        complete: function () {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 버그 리포트 전송';
        }
    });
}

/**
 * 7. HTML2Canvas 및 그림판 로직 (기존 유지)
 */
function startBugReportProcess() {
    // alert('현재 화면을 캡처합니다. 확인을 누르고 1~2초만 기다려주세요.');
    html2canvas(document.body).then(function (renderedCanvas) {
        bgImageBase64 = renderedCanvas.toDataURL("image/png");
        showModal('bugPaintModal');
        initCanvasDraw(bgImageBase64);
    }).catch(function (err) { alert('캡처 중 오류가 발생했습니다.'); });
}

function initCanvasDraw(base64Str) {
    const img = new Image();
    img.onload = function () {
        // 화면 크기에 맞게 캔버스 사이즈 조절
        // const maxWidth = window.innerWidth * 0.8;
        // const maxHeight = window.innerHeight * 0.7;
        // let finalWidth = img.width;
        // let finalHeight = img.height;

        // if (img.width > maxWidth) { finalWidth = maxWidth; finalHeight = img.height * (maxWidth / img.width); }
        // if (finalHeight > maxHeight) { finalHeight = maxHeight; finalWidth = finalWidth * (maxHeight / finalHeight); }

        // canvasbug.width = finalWidth;
        // canvasbug.height = finalHeight;
        canvasbug.width = img.width;
        canvasbug.height = img.height;
        // ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = '#e84118';
        ctx.lineWidth = 3;
        ctx.font = '20px Arial';
        ctx.fillStyle = '#e84118';
    };
    img.src = base64Str;
}

function setTool(tool, btnElement) {
    currentTool = tool;
    document.getElementById('btnPaintToolRect').style.border = '1px solid #ccc';
    document.getElementById('btnPaintToolText').style.border = '1px solid #ccc';
    btnElement.style.border = '2px solid #e84118';
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvasbug.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    savedImageData = ctx.getImageData(0, 0, canvasbug.width, canvasbug.height);

    if (currentTool === 'text') {
        const text = prompt('입력할 텍스트를 작성하세요:');
        if (text) {
            ctx.fillText(text, startX, startY);
        }
        isDrawing = false;
    }
}

function draw(e) {

    if (!isDrawing || currentTool !== 'rect') return;
    const rect = canvasbug.getBoundingClientRect();
    const width = (e.clientX - rect.left) - startX;
    const height = (e.clientY - rect.top) - startY;

    ctx.putImageData(savedImageData, 0, 0);
    ctx.strokeRect(startX, startY, width, height);
}

function stopDrawing(e) {
    // if (!isDrawing || currentTool !== 'rect') { isDrawing = false; return; }
    // const rect = canvasbug.getBoundingClientRect();
    // const currentX = e.clientX - rect.left;
    // const currentY = e.clientY - rect.top;
    // const width = currentX - startX;
    // const height = currentY - startY;

    // if (Math.abs(width) > 5 && Math.abs(height) > 5) {
    //     ctx.strokeRect(startX, startY, width, height);
    // }
    isDrawing = false;
}

/**
 * 8. 모달 제어 유틸리티
 */
function showModal(id) { document.getElementById(id).style.display = 'block'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }



//단위테스트 생성소스 시작
//downloadUnitTestReport('김연희','주임','나루아이 / 개발자','P');
function downloadUnitTestReport(testerName, rank, deptRole, resultStatus) {

    testerName = testerName || '김민준';
    rank = rank || '';
    deptRole = deptRole || '나루아이 / 개발자';
    resultStatus = resultStatus || 'P';

    // 1. 활성화된 탭에서 ID와 화면명 추출
    var activeTab = document.querySelector('li.active[data-id^="tab_"]');
    if (!activeTab) {
        alert("현재 활성화된 탭을 찾을 수 없습니다.");
        return;
    }
    var spanElement = activeTab.querySelector('a span');
    var screenName = spanElement ? spanElement.innerText.trim() : "이름없음";
    var screenId = activeTab.getAttribute('data-id').replace('tab_', '');
    var target = document.getElementById('content');
    if(!target) { alert('챕쳐할 영역을 찾을수 없습니다.'); return;}

    // 3. 캡처 및 서버 전송
    html2canvas(target, {
        scale: 1, // 서버 부하 방지를 위해 배율 고정
        backgroundColor: "#ffffff" // 캡처 배경색 강제 지정 (투명 방지)
    }).then(function (canvas) {
        // 버튼 비활성화 (중복 클릭 방지 효과)
        // const btn = document.querySelector('.btn-download');
        // const originalText = btn.innerText;
        // btn.innerText = "⏳ 엑셀 생성 중...";
        // btn.disabled = true;

        $.ajax({
            url: '/test/generateExcelReport.json',
            type: 'POST',
            data: {
                screenId: screenId,
                screenName: screenName,
                imageData: canvas.toDataURL('image/png'),
                testerName: testerName,
                rank: rank,
                deptRole: deptRole,
                resultStatus: resultStatus
            },
            xhrFields: { responseType: 'blob' },
            success: function (blob) {
                var safeName = (screenName || '이름없음').replace(/[\\/:*?"<>|]/g, '_');
                var fileName = '[단위테스트결과서]' + screenId + '_' + safeName + '.xlsx';
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            },
            error: function () {
                alert("결과서 생성 중 오류가 발생했습니다. 서버 로그를 확인해주세요.");
            },
            complete: function () {
                console.log('단위테스트 엑셀문서 생성완료');
                // 통신 완료 후 버튼 원상복구
                // btn.innerText = originalText;
                // btn.disabled = false;
            }
        }).catch(function (e) {
            console.error(e);
            alert('화면 캡쳐 중 오류가 발생했습니다.');
        });
    });
}