// 전역 변수 설정 및 명단 배열화
let canvasbug, ctx;
let isDrawing = false;
let startX, startY;
let currentTool = 'rect'; // 'rect' or 'text'
let bgImageBase64 = '';

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
            <div id="bugUserInfo" class="bug-nav-btn user"></div>
            <button id="btnBugDashboard" class="bug-nav-btn">📊 현황판</button>
            <button id="btnBugLogout" class="bug-nav-btn logout">🔄 로그아웃</button>
            <button class="bug-nav-btn exl" onclick="downloadExcelReport();">엑셀다운로드</button>
        </div>
    `;

    // ③ 그림판 모달
    const paintModal = `
        <div id="bugPaintModal" class="modal">
            <div class="modal-content">
                <div class="bug-paint-toolbar">
                    <div>
                        <button id="btnPaintToolRect" class="action">🟥 박스 그리기</button>
                        <button id="btnPaintToolText">🔤 텍스트 입력</button>
                        <button id="btnPaintToolClear">🧹 초기화</button>
                    </div>
                    <div>
                        <button id="btnPaintSave" class="bug-paint-save-btn">💾 버그 리포트 전송</button>
                        <button id="btnClosePaintModal">❌ 취소</button>
                    </div>
                </div>
                <div class="bug_comment">
                    <div>
                        <div>로그인 아이디</div>
                        <div><input id="bugFinalCommentID" placeholder="테스트한 아이디" /></div>
                    </div>
                    <div>
                        <div>메뉴 진입 경로</div>
                        <div class="flex">
                            <select id="bugFinalCommentStep1"><option></option></select>
                            <select id="bugFinalCommentStep2"><option></option></select>
                            <select id="bugFinalCommentStep3"><option></option></select>
                        </div>
                    </div>
                    <div>
                        <div>액션 순서 및 결함 내용</div>
                        <div><textarea id="bugFinalComment" placeholder="결함내용을 작성해 주세요(엔터가능)"></textarea></div>
                    </div>                     
                </div>
                <div style="flex-grow:1; overflow:auto; display:flex; justify-content:center; align-items:flex-start;">
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
                            <col style="width:130px;" />
                            <col style="width:90px;" />
                            <col style="width:auto;" />
                            <col style="width:110px;" />
                            <col style="width:120px" />
                            <col style="width:auto" />
                            <col style="width:120px;" />
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
        <div id="bugImageModal" class="modal">
            <div class="modal-content bug-admin-content">
            <button type="button" onclick="hideModal('bugImageModal')" class="bug-close-btn"></button>
            <img id="bugPreviewImg" />
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loginModal + topNavHtml + paintModal + dashboardModal + imageModal);

    canvasbug = document.getElementById('bugCanvas');
    if (canvasbug) {
        ctx = canvasbug.getContext('2d');
        ctx.strokeStyle = '#e84118';
        ctx.lineWidth = 3;
        ctx.font = '20px Arial';
        ctx.fillStyle = '#e84118';
    }
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

    if (canvasbug) {
        canvasbug.addEventListener('mousedown', startDrawing);
        canvasbug.addEventListener('mousemove', draw);
        canvasbug.addEventListener('mouseup', stopDrawing);
        canvasbug.addEventListener('mouseout', stopDrawing);
    }

    // 대메뉴(Step1) 변경 시 이벤트
    $(document).on('change', '#bugFinalCommentStep1', function() {
        const selectedStep1 = $(this).val();
        const $step2 = $('#bugFinalCommentStep2');
        const $step3 = $('#bugFinalCommentStep3');

        $step2.hide().find('option:not([value=""])').remove();
        $step3.hide().find('option:not([value=""])').remove();

        if (!selectedStep1) return;

        // 선택한 대메뉴의 하위 자식 찾기
        const targetStep1 = gnbMenuTree.find(item => item.text === selectedStep1);
        if (targetStep1 && targetStep1.children.length > 0) {
            targetStep1.children.forEach(step2 => {
                $step2.append(`<option value="${step2.text}">${step2.text}</option>`);
            });
            $step2.show(); // 중메뉴 노출
        }
    });

    // 중메뉴(Step2) 변경 시 이벤트
    $(document).on('change', '#bugFinalCommentStep2', function() {
        const selectedStep1 = $('#bugFinalCommentStep1').val();
        const selectedStep2 = $(this).val();
        const $step3 = $('#bugFinalCommentStep3');

        $step3.hide().find('option:not([value=""])').remove();

        if (!selectedStep2) return;

        const targetStep1 = gnbMenuTree.find(item => item.text === selectedStep1);
        const targetStep2 = targetStep1 ? targetStep1.children.find(item => item.text === selectedStep2) : null;

        if (targetStep2 && targetStep2.children.length > 0) {
            targetStep2.children.forEach(step3 => {
                $step3.append(`<option value="${step3}">${step3}</option>`);
            });
            $step3.show(); // 소메뉴 노출
        }
    });
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
 * 5. 현황판 대시보드
 */
function openUnifiedDashboard() {
    const userInfo = checkFakeLogin();
    if (!userInfo) return;

    $.ajax({
        url: '/api/bugreport/list.json', 
        type: 'GET', 
        dataType: 'json',
        cache: true, 
        success: function (list) {
            const tbody = document.getElementById('bugAdminTableBody');
            tbody.innerHTML = '';
            
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

           filteredList.reverse().forEach(bug => {
                const tr = document.createElement('tr');
                
                // HTML 인젝션 방어
                const safeComment = bug.comment ? bug.comment.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                const safeDevComment = bug.devComment ? bug.devComment.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
                
                // 💡 [핵심 안전장치] 날짜형 ID(숫자만)이든 BUG_ 형태든 에러 없이 순수 ID만 추출합니다.
                const pureIdStr = bug.bugId.toString().replace('BUG_', '');

                let html = '';
                const role = userInfo.userRole;
                const status = bug.status;

                // 1. 역할 및 상태에 따른 행 노출 필터링 분기 최적화 (구조 단일화)
                if (role === 'tester' && (status === 'CLOSED' || status === 'CANCEL')) {
                    // 테스터인데 이미 종결/취소된 버그는 대시보드 행 생성 패스
                    return; 
                }
                if (role === 'developer' && (status === 'Y' || status === 'CLOSED' || status === 'CANCEL')) {
                    // 개발자인데 이미 완료/종결/취소된 버그는 패스
                    return;
                }
                // 💡 [Step 1] 전역 developerList 배열을 활용해 <option> 태그들을 생성합니다.
                const devOptions = developerList.map(dev => {
                    // 현재 버그에 배정된 개발자와 일치하면 자동으로 'selected' 처리
                    const isSelected = (bug.assignee === dev) ? 'selected' : '';
                    return `<option value="${dev}" ${isSelected}>${dev}</option>`;
                }).join('');

                // 💡 [Step 2] 역할(Role)에 따른 담당자 표기 분기 처리
                let assigneeHtml = '';

                if (userInfo.userRole === 'admin') {
                    // 👑 관리자일 때는 변경 가능한 셀렉트 박스를 노출합니다.
                    assigneeHtml = `
                        <select id="selDeveloperList_${bug.bugId}" 
                                onchange="changeAssigneeByAdmin('${bug.bugId}', this.value)">
                            <option value="미정" ${bug.assignee === '미정' ? 'selected' : ''}>미정</option>
                            ${devOptions}
                        </select>
                    `;
                } else {
                    // 🎯 테스터 및 개발자일 때는 기존처럼 텍스트로만 깔끔하게 보여줍니다.
                    assigneeHtml = `
                        <span style="color:${bug.assignee === '미정' ? 'red' : 'blue'}; font-weight:bold;">
                            ${bug.assignee}
                        </span>
                    `;
                }
                // 2. 공통 앞단 컬럼 생성 (날짜시간 ID 완벽 대응)
                html = `
                    <td>${pureIdStr}</td>
                    <td>${bug.reporter}</td>
                    <td class="script_ent">${safeComment}</td>
                    <td>${assigneeHtml}</td>
                `;

                // 3. 뒷단 액션 버튼 및 상태창 분기
                let actionHtml = `<button class="bug-nav-btn" style="background-color:#f39c12 !important; margin-bottom:2px;" onclick="viewBugImage('${bug.imagePath}')">캡쳐보기</button>`;
                
                //상태값 배열 정리
                const BUG_STATUS_LIST = [
                    { value: '',      label: '대기중', badgeText: '대기중',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'N',      label: 'N (접수)', badgeText: 'N (접수)',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'Y',      label: 'Y (완료)',    badgeText: 'Y (완료)',   color: '#27ae60', isLineThrough: false }
                ];
                const BUG_STATUS_LIST_TXT = [
                    { value: '',      label: '대기중', badgeText: '대기중',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'N',      label: 'N (접수)', badgeText: 'N (접수)',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'Y',      label: 'Y (조치완료)',    badgeText: 'Y (완료)',   color: '#27ae60', isLineThrough: false },
                    { value: 'R',      label: 'R (재결함)',      badgeText: 'R (재결함)', color: '#e74c3c', isLineThrough: false },
                    { value: 'CLOSED', label: '종결 (확인완료)',  badgeText: '종결',       color: '#2c3e50', isLineThrough: true  },
                    { value: 'CANCEL', label: '취소 (결함아님)',  badgeText: '취소',       color: '#f7aa03', isLineThrough: true }
                ];
                // 상태 변경 모달 렌더링 내부 예시
                let optionsHtml = '';
                BUG_STATUS_LIST.forEach(statusItem => {
                    const isSelected = (status === statusItem.value) ? 'selected' : '';
                    optionsHtml += `<option value="${statusItem.value}" ${isSelected}>${statusItem.label}</option>`;
                });

                if (role === 'developer') {
                    // 개발자용 선택 및 입력창 추가
                    html += `
                        <td>
                            <select id="status_${bug.bugId}" style="padding:5px;">
                                ${optionsHtml}
                            </select>
                        </td>
                        <td class="left"><input type="text" id="devCom_${bug.bugId}" value="${safeDevComment}" style="width:95%; padding:6px; box-sizing:border-box;"></td>
                        <td>${actionHtml}<br><button class="bug-nav-btn" onclick="updateBugByDev('${bug.bugId}')">저장</button></td>
                    `;
                } else {
                    // 테스터 및 관리자용 상태 배지 가독성 변환
                    // 1. 배열에서 현재 변수 'status' 값과 일치하는 상태 객체 찾기 (못 찾으면 기본값인 첫 번째 '대기중' 적용)
                    const currentStatus = BUG_STATUS_LIST_TXT.find(item => item.value === status) || BUG_STATUS_LIST_TXT[0];

                    // 2. 종결(isLineThrough: true)일 경우 적용할 취소선(text-decoration) 스타일 처리
                    const lineThroughStyle = currentStatus.isLineThrough ? 'text-decoration: line-through;' : '';
                    // 3. 🌟 배열 데이터를 활용해 세련된 파스텔톤 뱃지 HTML 자동 조립
                    let statusBadge = `
                        <span style="color: ${currentStatus.color}; font-weight:700; ${lineThroughStyle}">
                            ${currentStatus.badgeText}
                        </span>
                    `;

                    let actionBtn = '';
                    if (role === 'admin') {
                        actionBtn = `<button class="bug-nav-btn" style="background-color:#9b59b6!important;" onclick="assignDeveloperToBug('${bug.bugId}', '${bug.assignee}')">담당 배정</button>`;
                    }
                    if (role === 'tester' && status === 'Y') {
                        actionBtn = `
                            <button class="bug-nav-btn" style="background-color:#e74c3c !important; margin-top:2px;" onclick="startReopenProcess('${bug.bugId}')">재결함캡쳐</button>
                            <br><button class="bug-nav-btn" style="background-color:#16a087 !important; margin-top:2px;" onclick="updateBugStatus('${bug.bugId}','CANCEL')">결함취소</button>
                            <br><button class="bug-nav-btn" style="background-color:#4a69bd !important; margin-top:2px;" onclick="updateBugStatus('${bug.bugId}','CLOSED')">결함종결</button>
                        `;
                    }
                    
                    html += `
                        <td>${statusBadge}</td>
                        <td class="left">${safeDevComment}</td>
                        <td>${actionHtml}<br>${actionBtn}</td>
                    `;
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
 * 6. 백엔드 통신 API 함수들
 */
function downloadExcelReport() {
    if (!confirm('지금까지 접수된 버그 현황을 엑셀로 다운로드 하시겠습니까?')) return;
    window.location.href = '/api/bugreport/download.json';
}
// 💡 관리자가 [담당 배정] 버튼을 클릭했을 때 비로소 실행되는 함수
window.assignDeveloperToBug = function (bugId) {
    // 1. 해당 행의 셀렉트 박스 요소를 ID 기반으로 찾아옵니다.
    const selectElem = document.getElementById(`selDeveloperList_${bugId}`);
    
    if (!selectElem) {
        alert("배정할 셀렉트 박스를 찾을 수 없습니다.");
        return;
    }

    // 2. 버튼 클릭 시점에 선택되어 있는 최종 값을 변수에 할당합니다.
    const selectedAssignee = selectElem.value;

    if (!selectedAssignee) {
        alert("올바른 개발자를 선택해 주세요.");
        return;
    }

    if (!confirm(`담당자를 [${selectedAssignee}] 명으로 최종 배정하시겠습니까?`)) {
        return;
    }

    // 3. 백엔드로 통신 요청 수행
    $.ajax({
        url: '/api/bugreport/assign.json',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({
            bugId: bugId,
            assignee: selectedAssignee // 클릭한 순간의 최종 선택값
        }),
        dataType: 'json',
        success: function (res) {
            alert('담당 개발자 배정이 완료되었습니다!');
            if (typeof openUnifiedDashboard === 'function') {
                openUnifiedDashboard(); // 대시보드 리스트 새로고침
            }
        },
        error: function (xhr) {
            console.error("배정 처리 오류:", xhr.responseText);
            alert('서버 통신 중 오류가 발생했습니다.');
        }
    });
};
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
                openUnifiedDashboard(); 
            } else { alert('저장 실패: ' + res.message); }
        }
    });
};

window.updateBugStatus = function (bugId, newStatus) {
    const statusText = newStatus === 'CLOSED' ? '종결' : '취소';
    if (!confirm(`정말 이 결함을 [${statusText}] 처리하시겠습니까?`)) { return; }
    $.ajax({
        url: '/api/bugreport/update.json', type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId, status: newStatus }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success') {
                alert(`결함이 ${statusText} 처리 되었습니다.`);
                openUnifiedDashboard(); 
            } else { alert('저장 실패: ' + res.message); }
        }
    });
};

// window.assignDeveloperToBug = function (bugId, currentAssignee) {
//     const devName = prompt(`담당 개발자 이름을 입력하세요:`, currentAssignee === '미정' ? '' : currentAssignee);
//     if (!devName || devName.trim() === '') return;

//     $.ajax({
//         url: '/api/bugreport/assign.json', type: 'POST',
//         contentType: 'application/json; charset=utf-8',
//         data: JSON.stringify({ bugId: bugId, assignee: devName.trim() }),
//         dataType: 'json',
//         success: function (res) {
//             if (res.status === 'success') {
//                 alert(`${devName} 개발자가 배정되었습니다!`);
//                 openUnifiedDashboard(); 
//             } else { alert('배정 실패: ' + res.message); }
//         }
//     });
// };

window.viewBugImage = function (originalPath) {
    if (!originalPath) { alert('첨부된 이미지가 없습니다.'); return; }
    const imgTag = document.getElementById('bugPreviewImg');
    
    // 경로에서 확장자와 폴더명을 걷어내고 순수 날짜시간 문자열만 발라냅니다.
    const pathParts = originalPath.split('/');
    const lastPart = pathParts[pathParts.length - 1] || '';
    const pureBugId = lastPart.replace('.png', ''); 
    
    console.log("🎯 요청할 pureBugId:", pureBugId);
    
    // 캐시 방지를 위해 랜덤 타임스탬프 파라미터를 뒤에 추가합니다.
    imgTag.src = '/api/bugreport/image.json?bugId=' + encodeURIComponent(pureBugId) + '&t=' + new Date().getTime();
    showModal('bugImageModal');
};

// 전역 변수 구역(파일 상단)에 하나 추가
let reopenData = null; 

window.startReopenProcess = function (bugId) {
    if (!confirm('이 결함이 조치되지 않아 신규 캡쳐를 진행하시겠습니까?')) return;
    
    reopenTargetId = bugId;
    
    // 1. 🌟 현재 대시보드 리스트 데이터에서 해당 bugId의 기존 결함 정보 찾기
    // 리스트를 저장해둔 전역 배열 변수명(예: currentBugList 등)에 맞게 수정해 주세요.
    // 만약 전역 배열이 없다면 $.getJSON('/api/bugreport/list.json')으로 서버에서 새로 찾아와도 됩니다.
    if (typeof mockBugList !== 'undefined') {
        reopenData = mockBugList.find(b => b.bugId === bugId);
    } else {
        // 혹시 프론트엔드 전역에 리스트 배열이 없다면 안전하게 서버에 요청해서 가져옵니다.
        $.ajax({
            url: '/api/bugreport/list.json',
            type: 'GET',
            async: false, // 동기식으로 진행해서 데이터를 확실히 확보
            success: function(list) {
                reopenData = list.find(b => b.bugId === bugId);
            }
        });
    }

    hideModal('bugAdminModal');
    startBugReportProcess(); // 캡처 시작
};

function saveAndReportBug() {
    // 1. 각각 분할된 input/select/textarea에서 값을 가져옵니다.// 1. 로그인 아이디 및 결함 내용 가져오기
    const loginId = document.getElementById('bugFinalCommentID').value.trim();
    const comment = document.getElementById('bugFinalComment').value.trim();

    // 2. 🌟 3단계 메뉴 경로 값 안전하게 수집하기
    // jQuery 객체([0])나 document.getElementById를 사용하여 값을 가져옵니다.
    const step1El = document.getElementById('bugFinalCommentStep1');
    const step2El = document.getElementById('bugFinalCommentStep2');
    const step3El = document.getElementById('bugFinalCommentStep3');

    // 만약 엘리먼트가 존재하지 않으면 빈값처리하여 에러를 방지(Null Guard)
    const step1 = step1El ? step1El.value : '';
    const step2 = step2El ? step2El.value : '';
    const step3 = step3El ? step3El.value : '';
    // 3. 필수 입력값 검사 (유효성 체크)
    if (!loginId) { alert('로그인 아이디를 입력해주세요.'); return; }
    if (!step1) { alert('메뉴 진입 경로(대메뉴)를 선택해주세요.'); return; }
    if (!comment) { alert('액션 순서 및 결함 내용을 입력해야 저장됩니다.'); return; }
    // 4. 존재하는 하위 카테고리 경로까지만 화살표로 조합
    let menuPath = step1;
    if (step2) menuPath += ` > ${step2}`;
    if (step3) menuPath += ` > ${step3}`;
    // 5. 최종 데이터 조합
    let finalComment = `로그인 아이디 : ${loginId}\n메뉴 진입 경로 : ${menuPath}\n액션 순서 및 결함 내용 :\n${comment}`;

    if (reopenTargetId) {
        finalComment = `[재결함 : ${reopenTargetId}] \n로그인 아이디 : ${loginId}\n메뉴 진입 경로 : ${menuPath}\n액션 순서 및 결함 내용 :\n${comment}`;
    }
    if (!comment) { alert('코멘트를 입력해야 저장됩니다.'); return; }
    if (!confirm('결함을 서버로 전송하시겠습니까?')) return;

    const saveBtn = document.getElementById('btnPaintSave');
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 전송 중...';

    const editedImageBase64 = canvasbug.toDataURL('image/png');
    const userInfo = checkFakeLogin();

    // 💡 [핵심] 프론트엔드에서 날짜+시간(년월일시분초) 기반 고유 ID 직접 생성 (예: 20260522163015)
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const koreanTime = new Date(now.getTime() - offset);
    const dateBugId = koreanTime.toISOString().replace(/[^0-9]/g, "").slice(0, 14); 

    const bugData = {
        bugId: dateBugId, // 👈 백엔드로 날짜 ID를 명시적으로 던집니다.
        reporter: userInfo ? userInfo.userName : '익명',
        comment: finalComment,
        imageData: editedImageBase64, 
        reopenTargetId: reopenTargetId || ''
    };

    $.ajax({
        url: '/api/bugreport/save.json',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(bugData), 
        dataType: 'json',
        success: function(response) {
            alert('버그 리포트가 전송되었습니다.');
            // 다음 입력을 위해 양식 초기화
            document.getElementById('bugFinalCommentID').value = '';
            document.getElementById('bugFinalComment').value = '';
            // 셀렉트 박스들을 첫 번째 '선택' 항목으로 초기화하고 중/소메뉴 숨기기
            $('#bugFinalCommentStep1').val('').trigger('change');
            hideModal('bugPaintModal');
            reopenTargetId = null;
            openUnifiedDashboard();
        },
        error: function(xhr) {
            console.error("에러:", xhr.responseText);
            alert('서버 전송 실패! 백엔드 터미널 창의 에러 메시지를 확인하세요.');
        },
        complete: function() {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 버그 리포트 전송';
        }
    });
}

/**
 * 7. HTML2Canvas 및 그림판 로직
 */
function startBugReportProcess() {
    html2canvas(document.body).then(function (renderedCanvas) {
        bgImageBase64 = renderedCanvas.toDataURL("image/png");
        showModal('bugPaintModal');
        initCanvasDraw(bgImageBase64);
    }).catch(function (err) { alert('캡처 중 오류가 발생했습니다.'); });
}

function initCanvasDraw(base64Str) {
    const img = new Image();
    img.onload = function () {
        canvasbug.width = img.width;
        canvasbug.height = img.height;
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = '#e84118';
        ctx.lineWidth = 3;
        ctx.font = '20px Arial';
        ctx.fillStyle = '#e84118';
        // 🌟 GNB 트리 데이터 추출 및 셀렉트 박스 초기화
        gnbMenuTree = [];
        const $step1 = $('#bugFinalCommentStep1');
        const $step2 = $('#bugFinalCommentStep2');
        const $step3 = $('#bugFinalCommentStep3');
        // 1. 모든 셀렉트 박스의 기존 옵션 완전히 비우기
        $step1.empty();
        $step2.hide().empty();
        $step3.hide().empty();

        // 2. 첫 번째 대메뉴에 value가 빈값("")인 "선택" 옵션을 최상단에 명시적으로 추가 🌟
        $step1.append('<option value="">선택</option>');
        $step2.append('<option value="">중메뉴 선택</option>');
        $step3.append('<option value="">소메뉴 선택</option>');

        // .gnb_txt > li (1단계 대메뉴) 순회
        $('.gnb_txt > li').each(function() {
            const step1Text = $(this).children('a').text().trim();
            if (!step1Text) return;

            const step1Node = { text: step1Text, children: [] };

            // 2단계 중메뉴 순회
            $(this).substring = $(this).find('> ul > li').each(function() {
                const step2Text = $(this).children('a').text().trim();
                if (!step2Text) return;

                const step2Node = { text: step2Text, children: [] };

                // 3단계 소메뉴 순회
                $(this).find('> ul > li').each(function() {
                    const step3Text = $(this).children('a').text().trim();
                    if (step3Text) {
                        step2Node.children.push(step3Text);
                    }
                });

                step1Node.children.push(step2Node);
            });

            gnbMenuTree.push(step1Node);
            $step1.append(`<option value="${step1Text}">${step1Text}</option>`);
        });
        // ----------------------------------------------------
        // 🌟 [추가] 재결함 프로세스인 경우 이전 데이터 바인딩 로직
        // ----------------------------------------------------
        if (reopenTargetId && reopenData) {
            console.log("=== 🔄 재결함 이전 데이터 복원 시작 ===");

            // 1. 기존 comment에서 로그인 ID와 결함 내용 본문 추출하기
            // (저장할 때 형식을 '로그인 아이디 : ID\n메뉴 진입 경로 : Path\n액션 순서 및 결함 내용 :\n본문' 구조로 보냈기 때문에 파싱이 필요합니다.)
            const fullComment = reopenData.comment || '';
            
            // 로그인 ID 추출
            const idMatch = fullComment.match(/로그인 아이디\s*:\s*(.*)/);
            if (idMatch && idMatch[1]) {
                const prevId = idMatch[1].split('\n')[0].trim();
                $('#bugFinalCommentID').val(prevId);
            }

            // 본문 내용 추출 ("액션 순서 및 결함 내용 :" 뒷부분 전체 추출)
            const bodyIdx = fullComment.indexOf('액션 순서 및 결함 내용 :');
            if (bodyIdx !== -1) {
                // 헤더 문구 제외한 순수 텍스트 본문만 가져오기
                const prevBody = fullComment.substring(bodyIdx).replace('액션 순서 및 결함 내용 :', '').trim();
                $('#bugFinalComment').val(prevBody);
            }

            // 2. 🌟 3단계 카테고리 셀렉트 박스 강제 동기화 복원
            // comment 내의 "메뉴 진입 경로 : 메뉴1 > 메뉴1_1" 문자열을 잘라냅니다.
            const pathMatch = fullComment.match(/메뉴 진입 경로\s*:\s*(.*)/);
            if (pathMatch && pathMatch[1]) {
                const fullPathStr = pathMatch[1].split('\n')[0].trim(); // 예: "메뉴1 > 메뉴1_1 > 메뉴1_1_1"
                const pathArray = fullPathStr.split('>').map(p => p.trim()); // ['메뉴1', '메뉴1_1', '메뉴1_1_1']

                // 대메뉴(Step1) 세팅 및 change 이벤트 트리거 -> 중메뉴가 열림
                if (pathArray[0]) {
                    $('#bugFinalCommentStep1').val(pathArray[0]).trigger('change');
                    
                    // 중메뉴(Step2) 세팅 및 change 이벤트 트리거 -> 소메뉴가 열림
                    if (pathArray[1]) {
                        $('#bugFinalCommentStep2').val(pathArray[1]).trigger('change');
                        
                        // 소메뉴(Step3) 세팅
                        if (pathArray[2]) {
                            $('#bugFinalCommentStep3').val(pathArray[2]);
                        }
                    }
                }
            }
            
            // 데이터 사용 후 메모리 누수 방지를 위해 초기화
            reopenData = null; 
        } else {
            // 일반 신규 등록일 때는 깔끔하게 빈칸으로 시작
            $('#bugFinalCommentID').val('');
            $('#bugFinalComment').val('');
        }
    };
    img.src = base64Str;
}

function setTool(tool, btnElement) {
    currentTool = tool;
    // 1. 기존에 .action 클래스가 붙어있던 버튼들에게서 클래스를 제거합니다.
    document.getElementById('btnPaintToolRect').classList.remove('action');
    document.getElementById('btnPaintToolText').classList.remove('action');
    
    // 2. 현재 클릭한 버튼 요소(btnElement)에만 .action 클래스를 추가합니다.
    if (btnElement) {
        btnElement.classList.add('action');
    }
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
    isDrawing = false;
}

/**
 * 8. 모달 제어 유틸리티
 */
function showModal(id) { document.getElementById(id).style.display = 'block'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function downloadUnitTestReport(testerName, rank, deptRole, resultStatus) {
    testerName = testerName || '김민준';
    rank = rank || '';
    deptRole = deptRole || '나루아이 / 개발자';
    resultStatus = resultStatus || 'P';

    var activeTab = document.querySelector('li.active[data-id^="tab_"]');
    if (!activeTab) {
        alert("현재 활성화된 탭을 찾을 수 없습니다.");
        return;
    }
    var spanElement = activeTab.querySelector('a span');
    var screenName = spanElement ? spanElement.innerText.trim() : "이름없음";
    var screenId = activeTab.getAttribute('data-id').replace('tab_', '');
    var target = document.getElementById('content');
    if(!target) { alert('캡쳐할 영역을 찾을수 없습니다.'); return;}

    html2canvas(target, {
        scale: window.devicePixelRatio * 2, // 🌟 기본 해상도보다 2배 이상 선명하게 캡처
        useCORS: true,                      // 이미지 깨짐 방지용
        backgroundColor: "#ffffff" 
    }).then(function (canvas) {
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
            }
        });
    });
}