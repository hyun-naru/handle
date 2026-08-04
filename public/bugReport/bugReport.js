// 전역 변수 설정 및 명단 배열화
let canvasbug, ctx;
let isDrawing = false;
let startX, startY;
let currentTool = 'rect'; // 'rect' or 'text'
let bgImageBase64 = '';

let developerList = ['개발자1', '개발자2', '개발자3'];
let testerList = ['테스터1', '테스터2', '테스터3', '테스터4'];
let adminList = ['관리자1', '관리자2'];

let savedImageData = null;
let reopenTargetId = null; // 재결함 ID
let reopenData = null; // 재결함 이전 복원 데이터
let editData = null; // 💡 [추가] 결함 수정 시 기존 복원 데이터
let gnbMenuTree = []; // GNB 동적 메뉴 트리

const SESSION_KEY_NAME = 'BUG_REPORT_USER_NAME';
const SESSION_KEY_ROLE = 'BUG_REPORT_USER_ROLE';

// 💡 [핵심] 현재 접속한 환경(로컬 vs 웹배포)을 자동 감지하여 API 주소 설정
const getApiBaseUrl = () => {
    const host = window.location.hostname;
    
    // 1. 로컬 개발 환경인 경우 (localhost 또는 127.0.0.1)
    if (host === 'localhost' || host === '127.0.0.1') {
        return ''; // 상대 경로 사용 (Express가 프론트/백엔드 모두 서빙하거나 로컬 3000포트 이용)
    }
    
    // 2. GitHub Pages 등 외부 정적 웹에서 실행 중인 경우 -> Render 백엔드 주소 지정
    return 'https://handle-cl1q.onrender.com'; // 👈 본인의 실제 Render 도메인으로 작성
};

const API_BASE = getApiBaseUrl();

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
                            <col style="width:80px;" />
                            <col style="width:90px;" />
                            <col style="width:160px;" />
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
                                <th>로그인 ID</th>
                                <th>메뉴 진입 경로</th>
                                <th>결함 내용</th>
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
            url: API_BASE + '/api/bugreport/list.json', 
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
    } else if (role === 'developer') { // 👈 개발자 로그인 처리 추가
        $.ajax({
            url: API_BASE + '/api/bugreport/list.json', 
            type: 'GET', 
            dataType: 'json',
            success: function (list) {
                // 나에게 배정된 버그 중 'B'(재결함) 상태인 건수 조회
                const reBugs = list.filter(b => b.assignee === name && b.status === 'B');
                if (reBugs.length > 0) {
                    alert(`⚠️ [알림] ${name}님에게 반려/재결함(B) 처리된 결함이 ${reBugs.length}건 있습니다.\n현황판에서 확인 후 재조치 부탁드립니다.`);
                } else {
                    alert(`${name}님(개발자) 환영합니다!`);
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
        url: API_BASE + '/api/bugreport/list.json', 
        type: 'GET', 
        dataType: 'json',
        cache: false, 
        success: function (list) {
            // 배열 데이터가 정상적으로 들어왔을 때만 진행
            if (!Array.isArray(list)) list = [];
            const tbody = document.getElementById('bugAdminTableBody');
            tbody.innerHTML = '';
            
            let filteredList = list;
            if (userInfo.userRole === 'tester') {
                filteredList = list.filter(b => b.reporter === userInfo.userName);
            } else if (userInfo.userRole === 'developer') {
                filteredList = list.filter(b => b.assignee === userInfo.userName);
            }

            if (filteredList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px;">조회된 버그 리포트가 없습니다.</td></tr>`;
                showModal('bugAdminModal');
                return;
            }

           filteredList.reverse().forEach(bug => {
                const tr = document.createElement('tr');
                const role = userInfo.userRole;
                const status = bug.status || '';                              
                const safeLoginId = (bug.loginId || '-').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeMenuPath = (bug.menuPath || '-').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeBody = (bug.comment || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeDevComment = (bug.devComment || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                // 💡 [Step 1] 전역 developerList 배열을 활용해 <option> 태그들을 생성합니다.
                // developerList가 진짜 배열인지 확인하고, 아니면 빈 배열([])을 사용하여 에러를 방지합니다.
                const safeDeveloperList = Array.isArray(developerList) ? developerList : [];
                const devOptions = safeDeveloperList.map(dev => {
                    // 현재 버그에 배정된 개발자와 일치하면 자동으로 'selected' 처리
                    const isSelected = (bug.assignee === dev) ? 'selected' : '';
                    return `<option value="${dev}" ${isSelected}>${dev}</option>`;
                }).join('');

                // 💡 [Step 2] 역할(Role)에 따른 담당자 표기 분기 처리
                let assigneeHtml = '';

                if (role === 'admin') {
                    // 👑 관리자일 때는 변경 가능한 셀렉트 박스를 노출합니다.
                    assigneeHtml = `
                        <select id="selDeveloperList_${bug.bugId}" onchange="assignDeveloperToBug('${bug.bugId}', this.value)">
                            <option value="미정" ${bug.assignee === '미정' ? 'selected' : ''}>미정</option>
                            ${devOptions}
                        </select>
                    `;
                } else {
                    // 🎯 테스터 및 개발자일 때는 기존처럼 텍스트로만 깔끔하게 보여줍니다.
                    assigneeHtml = `
                        <span style="color:${bug.assignee === '미정' ? 'red' : 'blue'}; font-weight:bold;">
                            ${bug.assignee || '미정'}
                        </span>
                    `;
                }
                // 💡 [수정 2] 다양한 데이터 타입(boolean, 'Y', 'true') 완벽 대응
                const isEditedBug = bug.isEdited === 'Y' || bug.isEdit === true || bug.isEdit === 'true' || bug.isEdited === true;

                const editBadge = isEditedBug 
                    ? `<span class="rectify">수정됨</span>` 
                    : '';
                // 2. 공통 앞단 컬럼 생성 (날짜시간 ID 완벽 대응)
                let html = `
                    <td>${bug.bugId}${editBadge}</td>
                    <td>${bug.reporter}</td>
                    <td>${safeLoginId}</td>
                    <td class="script_ent">${safeMenuPath}</td>
                    <td class="script_ent">${safeBody}</td>
                    <td>${assigneeHtml}</td>
                `;

                // 3. 상태 표시용 기본 설정 배열
                const BUG_STATUS_LIST = [
                    { value: '', label: '대기중' },
                    { value: 'N', label: '접수대기' },
                    { value: 'J', label: '접수' },
                    { value: 'B', label: '재결함(처리안됨)' },
                    { value: 'Y', label: '완료' }
                ];
                const BUG_STATUS_LIST_TXT = [
                    { value: '',      label: '대기중', badgeText: '대기중',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'N',      label: '접수대기', badgeText: '접수대기',   color: '#7f8c8d', isLineThrough: false },
                    { value: 'J',      label: '접수', badgeText: '접수',   color: '#0284c7', isLineThrough: false },
                    { value: 'Y',      label: '조치완료', badgeText: '완료',   color: '#2563eb', isLineThrough: false },
                    { value: 'R',      label: '재결함(새로작성)', badgeText: '재결함(새로작성)', color: '#ff0095', isLineThrough: false },
                    { value: 'B',      label: '재결함(처리안됨)', badgeText: '재결함(처리안됨)', color: '#f75b01', isLineThrough: false },
                    { value: 'CLOSED', label: '종결 (확인완료)',  badgeText: '종결',       color: '#16a34a', isLineThrough: true  },
                    { value: 'CANCEL', label: '취소 (결함아님)',  badgeText: '취소',       color: '#475569', isLineThrough: true }
                ];

                let actionHtml = `<button class="bug-nav-btn warning" onclick="viewBugImage('${bug.imagePath}')">캡쳐보기</button>`;

                // 4. 권한별 상태 열(Column) & 액션 버튼 렌더링
                if (role === 'developer') {
                    // 상태 변경 모달 렌더링 내부 예시
                    let optionsHtml = '';
                    BUG_STATUS_LIST.forEach(statusItem => {
                        const isSelected = (status === statusItem.value) ? 'selected' : '';
                        optionsHtml += `<option value="${statusItem.value}" ${isSelected}>${statusItem.label}</option>`;
                    });
                    // 개발자용 선택 및 입력창 추가
                    html += `
                        <td>
                            <select id="status_${bug.bugId}" onchange="updateBugByDev('${bug.bugId}', this.value)">
                                ${optionsHtml}
                            </select>
                        </td>
                        <td class="left"><input type="text" id="devCom_${bug.bugId}" value="${safeDevComment}"></td>
                        <td>${actionHtml}</td>
                    `;
                } else {
                    // 🔍 테스터 & 👑 관리자 권한
                    let actionBtn = '';

                    if (role === 'tester') {
                        // 취소 버튼 기본 노출
                        actionBtn = `<button class="bug-nav-btn colse" onclick="updateBugStatus('${bug.bugId}', 'CANCEL')">취소(기록)</button>`;
                        
                        if (status === 'Y') {
                            // 완료(Y) 상태일 때 노출되는 버튼
                            actionBtn = `
                                <button class="bug-nav-btn reset" onclick="startReopenProcess('${bug.bugId}')">재결함캡쳐</button>
                                <button class="bug-nav-btn rollback" onclick="updateBugStatus('${bug.bugId}', 'B')">결함확인X</button>
                                <button class="bug-nav-btn success" onclick="updateBugStatus('${bug.bugId}','CLOSED')">결함종결</button>
                            `;
                        } else if (status !== 'J' && status !== 'Y') {  
                            // 접수(J)나 완료(Y) 상태가 아닐 때 삭제(파기) 가능
                            actionBtn += `
                                <button class="bug-nav-btn danger" onclick="deleteBugReport('${bug.bugId}')">삭제(파기)</button>
                                <button class="bug-nav-btn info" onclick="editBugReport('${bug.bugId}')">수정</button>
                            `;
                        }
                    } else if (role === 'admin') {
                        
                        // 취소 버튼 기본 노출
                        if (status !== 'J' && status !== 'Y') {  
                            // 접수(J)나 완료(Y) 상태가 아닐 때 삭제(파기) 가능
                            actionBtn += `
                                <button class="bug-nav-btn close" onclick="updateBugStatus('${bug.bugId}', 'CANCEL')">취소(기록)</button>
                                <button class="bug-nav-btn danger" onclick="deleteBugReport('${bug.bugId}')">삭제(파기)</button>
                            `;
                        }  
                    }

                    // 상태 배지 뱃지 처리
                    const currentStatus = BUG_STATUS_LIST_TXT.find(item => item.value === status) || BUG_STATUS_LIST_TXT[0];

                    // 2. 종결(isLineThrough: true)일 경우 적용할 취소선(text-decoration) 스타일 처리
                    const lineThroughStyle = currentStatus.isLineThrough ? 'text-decoration: line-through;' : '';
                    // 3. 🌟 배열 데이터를 활용해 세련된 파스텔톤 뱃지 HTML 자동 조립
                    const statusBadge = `
                        <span style="color: ${currentStatus.color}; font-weight:700; ${lineThroughStyle}">
                            ${currentStatus.badgeText}
                        </span>
                    `;
                    
                    html += `
                        <td>${statusBadge}</td>
                        <td class="left">${safeDevComment}</td>
                        <td>${actionHtml}${actionBtn}</td>
                    `;
                }

                tr.innerHTML = html;
                tbody.appendChild(tr);
                
            });
            showModal('bugAdminModal');
        },
        error: function (xhr, status, error) {
            console.error("list.json 로드 실패:", status, error);
            alert('버그 리포트 목록을 불러오지 못했습니다. (404 Not Found)');
        }
        //error: function () { alert('현황판 데이터를 불러오는데 실패했습니다.'); }
    });
}

/**
 * 6. 백엔드 통신 API 함수들
 */
function downloadExcelReport() {
    if (!confirm('지금까지 접수된 버그 현황을 엑셀로 다운로드 하시겠습니까?')) return;
    window.location.href = API_BASE + '/api/bugreport/download.json';
}
// 💡 관리자가 담당 배정 함수
/**
 * 셀렉트 박스 변경 시 즉시 담당 개발자를 저장하는 함수
 */
window.assignDeveloperToBug = function (bugId, selectedAssignee) {
    // 만약 파라미터로 넘어오지 않았다면 (예외 방어 코드)
    if (!selectedAssignee) {
        const selectElem = document.getElementById(`selDeveloperList_${bugId}`);
        if (selectElem) selectedAssignee = selectElem.value;
    }

    if (!selectedAssignee) {
        alert("올바른 개발자를 선택해 주세요.");
        return;
    }

    console.log(`👤 즉시 배정 시작 - 버그 ID: ${bugId}, 선택된 담당자: ${selectedAssignee}`);

    // 💡 1. 전송할 데이터 객체 구성 (미정 선택 시 상태를 '접수대기'인 'N'으로 설정)
    const requestData = {
        bugId: bugId,
        assignee: selectedAssignee
    };

    if (selectedAssignee === '미정') {
        requestData.status = 'N'; // '미정'으로 바뀌면 상태를 접수대기(N)로 변경
    }

    $.ajax({
        url: API_BASE + '/api/bugreport/assign.json', // 프로젝트 컨텍스트 패스 반영
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(requestData),
        dataType: 'json',
        success: function (res) {
            const successMsg = selectedAssignee === '미정' 
                ? `담당자가 [미정]으로 변경되어 상태가 [접수대기]로 전환되었습니다.` 
                : `담당자가 [${selectedAssignee}] 개발자로 변경 및 저장되었습니다.`;
            
            alert(successMsg);
            
            // 대시보드 리스트 실시간 새로고침
            if (typeof openUnifiedDashboard === 'function') {
                openUnifiedDashboard(); 
            }
        },
        error: function (xhr) {
            console.error("즉시 배정 처리 오류:", xhr.responseText);
            alert('서버 통신 중 오류가 발생하여 배정에 실패했습니다.');
            
            // 실패 시 원래대로 새로고침하여 복구
            if (typeof openUnifiedDashboard === 'function') {
                openUnifiedDashboard(); 
            }
        }
    });
};
/**
 * 개발자 조치 상태 변경 시 즉시 서버에 업데이트하는 함수
 */
/**
 * 개발자 조치 상태 변경 시 즉시 서버에 업데이트하는 함수
 */
window.updateBugByDev = function (bugId, selectValue) {
    // 1. 파라미터로 넘어온 상태값이 없다면 DOM 엘리먼트에서 직접 가져옵니다.
    let status = selectValue;
    if (!status) {
        const statusElem = document.getElementById(`status_${bugId}`);
        if (statusElem) status = statusElem.value;
    }

    // 2. 해당 결함(bugId) 행에 작성되어 있는 개발자 코멘트 값을 찾아옵니다.
    const devComElem = document.getElementById(`devCom_${bugId}`);
    const devComment = devComElem ? devComElem.value.trim() : "";

    console.log(`⚙️ 조치 상태 즉시 변경 - 버그 ID: ${bugId}, 상태: ${status}, 코멘트: ${devComment}`);

    // 3. 백엔드로 즉시 통신 요청 처리
    $.ajax({
        url: API_BASE + '/api/bugreport/update.json',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ 
            bugId: bugId, 
            status: status, 
            devComment: devComment 
        }),
        dataType: 'json',
        success: function (res) {
            // 서버 반환 규격 호환성 처리 (res.status 또는 res.success 체크)
            if (res.status === 'success' || res.success) {
                alert('조치 상태가 즉시 변경 및 저장되었습니다!');
                
                if (typeof openUnifiedDashboard === 'function') {
                    openUnifiedDashboard(); // 대시보드 새로고침
                }
            } else { 
                alert('저장 실패: ' + (res.message || '서버 응답 오류')); 
            }
        },
        error: function (xhr) {
            console.error("조치 상태 변경 오류:", xhr.responseText);
            alert('서버 통신 중 오류가 발생했습니다.');
            
            // 실패 시 대시보드를 원래대로 복구
            if (typeof openUnifiedDashboard === 'function') {
                openUnifiedDashboard(); 
            }
        }
    });
};

window.updateBugStatus = function (bugId, newStatus) {
    const statusText = newStatus === 'CLOSED' ? '종결' : (newStatus === 'CANCEL' ? '취소' : '재결함');
    if (!confirm(`정말 이 결함을 [${statusText}] 처리하시겠습니까?`)) { return; }
    $.ajax({
        url: API_BASE + '/api/bugreport/update.json', 
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId, status: newStatus }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success' || res.success) {
                alert(`결함이 ${statusText} 처리 되었습니다.`);
                openUnifiedDashboard(); 
            } else { alert('저장 실패: ' + res.message); }
        }
    });
};
// 수정 버튼 클릭 시 실행되는 함수
window.editBugReport = function (bugId) {
    if (!confirm(`결함 [${bugId}] 데이터를 수정하시겠습니까?`)) return;

    $.ajax({
        url: API_BASE + '/api/bugreport/list.json',
        type: 'GET',
        cache: false,
        success: function(list) {
            const bug = list.find(b => b.bugId === bugId);
            if (!bug) {
                alert('해당 버그 리포트 정보를 찾을 수 없습니다.');
                return;
            }

            // 💡 editData 세팅
            editData = bug;
            hideModal('bugAdminModal');
            showModal('bugPaintModal');

            // 1. 기존 이미지 경로가 있으면 캔버스에 로드, 없으면 현재 화면 캡처
            if (bug.imagePath) {
                // 💡 확장자 중복 방지 처리 (.png가 이미 있으면 안 붙임)
                let pureBugId = bugId.endsWith('.png') ? bugId : bugId + '.png';
                const imageSrc = API_BASE + '/api/bugreport/image.json?bugId=' + encodeURIComponent(pureBugId) + '&t=' + new Date().getTime();
                initCanvasDraw(imageSrc);
            } else {
                startBugReportProcess();
            }
        },
        error: function() {
            alert('버그 리포트 정보를 불러오는 데 실패했습니다.');
        }
    });
};

// 폼 필드(ID, 메뉴, 내용)에 기존 데이터를 채워 넣는 독립 함수
function populateFormFields(targetData) {
    if (!targetData) return;

    // 1. 로그인 ID 복원
    if (targetData.loginId) {
        $('#bugFinalCommentID').val(targetData.loginId);
    }

    // 2. 결함 내용 복원
    if (targetData.comment) {
        $('#bugFinalComment').val(targetData.comment);
    }

    // 3. 메뉴 진입 경로 복원 (단계별 세팅)
    if (targetData.menuPath) {
        const pathArray = targetData.menuPath.split('\n\n').map(p => p.trim());
        if (pathArray[0]) {
            $('#bugFinalCommentStep1').val(pathArray[0]).trigger('change');
            
            // Step1 변경에 따른 Option 렌더링 후 Step2 세팅
            setTimeout(() => {
                if (pathArray[1]) {
                    $('#bugFinalCommentStep2').val(pathArray[1]).trigger('change');
                    
                    setTimeout(() => {
                        if (pathArray[2]) {
                            $('#bugFinalCommentStep3').val(pathArray[2]);
                        }
                    }, 50);
                }
            }, 50);
        }
    }
}
window.deleteBugReport = function (bugId) {
    if (!confirm(`[경고] 결함 [${bugId}] 데이터를 완전히 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {
        return;
    }

    $.ajax({
        url: API_BASE + '/api/bugreport/delete.json',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify({ bugId: bugId }),
        dataType: 'json',
        success: function (res) {
            if (res.status === 'success' || res.success) {
                alert('결함 데이터 및 이미지가 완전히 삭제되었습니다.');
                openUnifiedDashboard(); // 목록 실시간 새로고침
            } else {
                alert('삭제 실패: ' + (res.message || '서버 응답 오류'));
            }
        },
        error: function (xhr) {
            console.error("삭제 요청 중 오류:", xhr.responseText);
            alert('서버 통신 오류로 인해 결함을 삭제하지 못했습니다.');
        }
    });
};

window.viewBugImage = function (originalPath) {
    if (!originalPath) { alert('첨부된 이미지가 없습니다.'); return; }
    const imgTag = document.getElementById('bugPreviewImg');
    
    console.log("🔍 백엔드에서 넘어온 원본 경로:", originalPath);

    let pureBugId = "";

    // 1. 만약 경로에 'bugId=' 쿼리스트링이 포함되어 있다면 그 값을 온전히 가져옵니다.
    if (originalPath.indexOf('bugId=') !== -1) {
        pureBugId = originalPath.split('bugId=')[1].split('&')[0];
        // 혹시 확장자(.png)가 붙어있지 않다면 서버 파일 매핑을 위해 붙여줍니다.
        if (pureBugId.indexOf('.png') === -1) {
            pureBugId += '.png';
        }
    } else {
        // 2. 일반 파일 경로 형태("/api/bugreport/202606101301522.png")인 경우 
        // 뒤의 파일명+확장자 전체("202606101301522.png")를 통째로 추출합니다.
        const pathParts = originalPath.split('/');
        pureBugId = pathParts[pathParts.length - 1] || '';
    }

    // 3. 주소창 인코딩 깨짐 및 불필요한 찌꺼기 문자열 최종 정제
    pureBugId = decodeURIComponent(pureBugId).replace('image.json?bugId=', '').trim();
    
    // 4. 확장자가 중복되지 않도록 방어 코드 추가 (.png.png 방지)
    if (pureBugId.endsWith('.png.png')) {
        pureBugId = pureBugId.replace('.png.png', '.png');
    }
    
    console.log("🎯 서버 파일 시스템과 대조할 최종 파일명(bugId):", pureBugId);
    
    // 5. 정확한 경로 명세에 컨텍스트 패스를 붙여 최종 요청을 보냅니다.
    imgTag.src = API_BASE + '/api/bugreport/image.json?bugId=' + encodeURIComponent(pureBugId) + '&t=' + new Date().getTime();
    
    showModal('bugImageModal');
};

// 전역 변수 구역(파일 상단)에 하나 추가
//let reopenData = null; 

window.startReopenProcess = function (bugId) {
    if (!confirm('이 결함이 조치되지 않아 신규 캡쳐를 진행하시겠습니까?')) return;
    
    reopenTargetId = bugId;
    
    $.ajax({
        url: API_BASE + '/api/bugreport/list.json',
        type: 'GET',
        async: false, // 동기식으로 진행해서 데이터를 확실히 확보
        success: function(list) {
            reopenData = list.find(b => b.bugId === bugId);
        }
    });
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
    if (step2 && step2.trim() !== '') {
        menuPath += `\n\n${' '.repeat(2)}${step2.trim()}`; // 2칸 들여쓰기
    }
    if (step3 && step3.trim() !== '') {
        menuPath += `\n\n${' '.repeat(4)}${step3.trim()}`; // 4칸 들여쓰기
    }
    if (!comment) { alert('코멘트를 입력해야 저장됩니다.'); return; }
    if (!confirm('결함을 서버로 전송하시겠습니까?')) return;

    const saveBtn = document.getElementById('btnPaintSave');
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 전송 중...';

    const editedImageBase64 = canvasbug.toDataURL('image/png');
    const userInfo = checkFakeLogin();

    // 💡 [핵심 해결 1] 타겟 ID 결정 로직
    // 수정(editData) 상태라면 기존 bugId를 사용하고, 아니면 신규 ID 생성
    let dateBugId = '';
    let isEditFlag = false;

    // editData 객체와 bugId 속성이 정확히 존재하는지 검증
    if (editData && String(editData.bugId).trim() !== '') {
        dateBugId = String(editData.bugId).trim(); // 기존 버그 ID 정확히 유지
        isEditFlag = true;
    } else {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const koreanTime = new Date(now.getTime() - offset);
    dateBugId = 'BUG_' + koreanTime.toISOString().replace(/[^0-9]/g, "").slice(0, 12); // YYYYMMDDHHMM
    }

    const bugData = {
        bugId: dateBugId, // 👈 백엔드로 날짜 ID를 명시적으로 던집니다.
        reporter: userInfo ? userInfo.userName : '익명',
        loginId: loginId,             
        menuPath: menuPath,            
        comment: comment,
        devComment: editData ? (editData.devComment || '') : '',
        imageData: editedImageBase64, 
        reopenTargetId: reopenTargetId || '',
        isEdit: isEditFlag,     // 백엔드 전달용 플래그
        isEdited: isEditFlag ? 'Y' : (editData && editData.isEdited ? editData.isEdited : 'N') // 현황판 표기용 ('Y')
    };

    console.log("📤 전송 데이터 확인:", bugData); // 콘솔에서 isEdit: true 및 bugId 확인용

    $.ajax({
        url: API_BASE + '/api/bugreport/save.json',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(bugData), 
        dataType: 'json',
        success: function(response) {
            alert(isEditFlag ? '결함 내용이 수정되었습니다.' : '버그 리포트가 전송되었습니다.');
            
            // 초기화
            document.getElementById('bugFinalCommentID').value = '';
            document.getElementById('bugFinalComment').value = '';
            // 셀렉트 박스들을 첫 번째 '선택' 항목으로 초기화하고 중/소메뉴 숨기기
            $('#bugFinalCommentStep1').val('').trigger('change');
            hideModal('bugPaintModal');
            
            // 💡 [핵심 해결 2] 수정/재결함 전역 변수 리셋
            editData = null;
            reopenTargetId = null;
            reopenData = null;
            
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
    // GNB 메뉴 트리는 매번 먼저 초기화
    gnbMenuTree = [];
    const $step1 = $('#bugFinalCommentStep1');
    const $step2 = $('#bugFinalCommentStep2');
    const $step3 = $('#bugFinalCommentStep3');

    $step1.empty().append('<option value="">선택</option>');
    $step2.hide().empty().append('<option value="">중메뉴 선택</option>');
    $step3.hide().empty().append('<option value="">소메뉴 선택</option>');

    $('.gnb > li').each(function() {
        const step1Text = $(this).children('a').text().trim();
        if (!step1Text) return;

        const step1Node = { text: step1Text, children: [] };

        $(this).find('> ul > li').each(function() {
            const step2Text = $(this).children('a').text().trim();
            if (!step2Text) return;

            const step2Node = { text: step2Text, children: [] };

            $(this).find('> ul > li').each(function() {
                const step3Text = $(this).children('a').text().trim();
                if (step3Text) step2Node.children.push(step3Text);
            });

            step1Node.children.push(step2Node);
        });

        gnbMenuTree.push(step1Node);
        $step1.append(`<option value="${step1Text}">${step1Text}</option>`);
    });

    // 💡 이미지 로딩과 무관하게 폼 필드 데이터부터 즉시 복원
    const targetData = editData || (reopenTargetId ? reopenData : null);
    if (targetData) {
        populateFormFields(targetData);
    } else {
        $('#bugFinalCommentID').val('');
        $('#bugFinalComment').val('');
    }

    // Canvas 배경 이미지 처리
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = function () {
        canvasbug.width = img.width;
        canvasbug.height = img.height;
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = '#e84118';
        ctx.lineWidth = 3;
        ctx.font = '20px Arial';
        ctx.fillStyle = '#e84118';
    };

    img.onerror = function() {
        console.warn("이미지를 불러오지 못했으나 텍스트 데이터는 정상 로드되었습니다.");
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
 * 8. 모달 제어 공통 헬퍼 함수 (추가)
 */
window.showModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex'; // 또는 프로젝트 CSS에 따라 'block'
    } else {
        console.warn(`[showModal] ID가 '${modalId}'인 모달 요소를 찾지 못했습니다.`);
    }
}

window.hideModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}