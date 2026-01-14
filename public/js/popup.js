document.addEventListener('DOMContentLoaded', function () {
selectPopup();
});

/** DOM 변경 감시 필요할때 
 * 필요 없으면 아래 팝업에서 observer.~ 지우기
// 전역에 MutationObserver 인스턴스를 생성하고 observerConfig도 정의
*/
// MutationObserver 옵션 (어떤 변경을 감지할지 설정)
const observerConfig = {
  attributes: true,        // 속성 변경 감지
  childList: true,         // 자식 노드 추가/삭제 감지
  subtree: true            // 하위 모든 노드까지 감지
};

// MutationObserver 콜백 함수
const observerCallback = function (mutationsList, observer) {
  for (const mutation of mutationsList) {
    // 필요한 감지 로직이 있다면 여기에 작성
    console.log('Mutation observed:', mutation);
  }
};

// MutationObserver 인스턴스 생성
const observer = new MutationObserver(observerCallback);

/**
 * 팝업 (full, bottom)
 */
var layerPopup = {
    // 팝업을 여는 함수
    open: function(layerId, init, initParam, callback, callbackParam, targetEle) {
        // 팝업 요소와 타겟 요소를 가져옵니다.
        let idPop = document.getElementById(layerId);
        let eTarget = (!!targetEle) ? targetEle : event.target; // 지정된 타겟 요소가 없으면 이벤트 타겟 사용
        try{
        	eTarget.setAttribute('data-focus', 'on'); // 타겟 요소에 data-focus 속성 추가
        } catch (e){
        	console.error(e)
        }
        let body = document.querySelector('body');
        let wrap = document.querySelector('.wrap');
        
        // 2중 팝업일 때 마지막 팝업을 상위에 지정
        let layerWrapCnt = 0;
        let zIdx = 1510;
        if (!!event) {
            layerWrapCnt = document.getElementsByClassName('popup_wrap').length;
            if (layerWrapCnt > 0) {
                zIdx = zIdx + 1; // 중첩된 팝업이 있을 경우 z-index 증가
            }
        }

        // 팝업 ID가 없을 경우 경고 메시지
        if (layerId == null || layerId.length == 0) {
            alert('팝업의 id값은 필수 입니다.');
            return false;
        }
        // 팝업의 z-index와 접근성 속성 설정
        idPop.style.zIndex = zIdx;
        idPop.setAttribute('tabindex', 0);
        idPop.setAttribute('role', 'dialog');
        idPop.setAttribute('aria-modal', 'true');
        idPop.setAttribute('aria-live', 'polite');
        idPop.setAttribute('aria-label', '팝업 영역');
        idPop.classList.add('now_open');

        // 스크롤 방지 및 aria-hidden 설정
        if (!body.classList.contains('pop_on')) {
            body.classList.add('pop_on');
            wrap.setAttribute('aria-hidden', 'true');
        }

        // dim 요소가 없으면 추가
        if (!idPop.querySelector('.dim')) {
            idPop.insertAdjacentHTML('afterbegin', '<div class="dim close"></div>');
        }

        // MutationObserver 시작 (팝업 열릴 때만 관찰 시작)
        observer.observe(idPop, observerConfig);
        // 팝업에 포커스 설정
        idPop.focus();
        layerPopup.focus(layerId); // 포커스 관리 함수 호출


        // 닫기 버튼에 이벤트 리스너 추가
        const popClose = idPop.querySelectorAll('.close');
        popClose.forEach((x) => {
            x.addEventListener('click', (e) => {
                e.preventDefault();
                layerPopup.close(layerId, callback, callbackParam); // 팝업 닫기
            });
        });

        // 초기화 함수가 있으면 호출
        if (typeof init === 'function') {
            init(initParam);
        }
    },

    // 팝업을 여는 추가 함수 (타겟 요소 직접 지정)
    openWithTargetEle: function(layerId, targetEle) {
        this.open(layerId, undefined, undefined, undefined, undefined, targetEle);
    },

    // 팝업을 닫는 함수
    close: function(layerId, callback, callbackParam) {
        let idPop = document.getElementById(layerId);
        let body = document.querySelector('body');
        let wrap = document.querySelector('.wrap');

        // 팝업의 접근성 속성 제거
        idPop.setAttribute('tabindex', -1);
        idPop.removeAttribute('role');
        idPop.removeAttribute('aria-label');        
        idPop.setAttribute('aria-modal', 'false');
        idPop.setAttribute('aria-live', 'off');
        idPop.classList.remove('now_open');

        // 포커스 관리 요소 제거
        let aFocus = idPop.querySelectorAll('.pop_focus');
        aFocus.forEach((af) => {
            af.remove();
        });

        // 열린 팝업이 없으면 스크롤 및 aria-hidden 해제
        let popLength = document.querySelectorAll('.now_open').length;
        if (popLength < 1) {
            body.classList.remove('pop_on');
            wrap.setAttribute('aria-hidden', 'false');
        }

        // 이전 포커스 요소로 돌아가기
        restoreFocus();

        // 콜백 함수가 있으면 호출
        if (typeof callback === 'function') {
            callback(callbackParam);
        }
        // MutationObserver 중지
        observer.disconnect();
    },

    // 팝업 내부의 포커스 관리 및 접근성 처리 함수
    focus: function(layerId) {
        let idPop = document.getElementById(layerId);
        // 포커스 가능한 요소들을 찾아 순환 관리
    let focusableElements = idPop.querySelectorAll("button:not([disabled]), input:not([type='hidden']):not([disabled]), select:not([disabled]), iframe, textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");
    if (focusableElements.length === 0) {
        // 포커스 가능한 요소가 없으면 팝업 자체에 포커스를 설정
        idPop.setAttribute('tabindex', '0');
        idPop.focus();
        return;
    }

    let firstFocusableElement = focusableElements[0];
    let lastFocusableElement = focusableElements[focusableElements.length - 1];

    // 팝업이 열리면 첫 번째 요소에 포커스
    firstFocusableElement.focus();

    // Tab 키 이벤트로 포커스 순환 제어
    idPop.addEventListener('keydown', function(event) {
        if (event.key === 'Tab' || event.keyCode === 9) {
            if (event.shiftKey) {
                // Shift + Tab: 첫 번째 요소에서 이전으로 이동 시 마지막으로 이동
                if (document.activeElement === firstFocusableElement) {
                    event.preventDefault();
                    lastFocusableElement.focus();
                }
            } else {
                // Tab: 마지막 요소에서 다음으로 이동 시 첫 번째로 이동
                if (document.activeElement === lastFocusableElement) {
                    event.preventDefault();
                    firstFocusableElement.focus();
                }
            }
        }
    });
    }
};
/**
 * Infomation 팝업 (alert, confirm)
 */
var layerInfo = {
    alert : function(title, contents, callback){
        this.alertOpen(title, contents, callback);
    },
    confirm : function(title, contents, yesCallback, noCallback){
        this.confirmOpen('1', title, contents, yesCallback, noCallback);
    },
    confirm2 : function(title, contents, yesCallback, noCallback){
        this.confirmOpen('2', title, contents, yesCallback, noCallback);
    },
    /**
     * alert
     * @param1 : title : alert의 제목 : 없을 경우 ''
     * @param2 : contents : alert의 내용 : 경로메세지(ex. 이름은 필수값 입니다.)
     * @param3 : callback함수 : alert의 '확인' 버튼 클릭 후 전달되는 콜백
     */
    alertOpen : function(title, contents, callback){   
        let body = document.querySelector('body');
        let wrap = document.querySelector('.wrap');
        let eTarget = event.target;
        eTarget.setAttribute('data-focus','on');

        if (!!title && title.indexOf('\n') >= 0) {
            title = title.replace(/\n/gi, '<br>');
        } else if (!title) {
            title = "";
        }

        if (!!contents && contents.indexOf('\n') >= 0) {
            contents = contents.replace(/\n/gi, '<br>');
        } else if (!contents) {
            contents = "";
        }

        let shownAlertLength = document.querySelectorAll('[data-Type="alert"]').length + 1;

        let html = this.alertHtml(title, contents, 'pop_alert' + shownAlertLength);
        let drawAlertId = 'pop_alert' + shownAlertLength;


        /**
         *  2중 팝업시 마지막 팝업 상위 지정
         **/
        let layerWrapCnt = 0;
        let zIdx = 999999;
        if (!!event) {
			layerWrapCnt = document.getElementsByClassName('popup_wrap').length;
            if (layerWrapCnt > 0) {
                zIdx = zIdx + 1;
            }
        }
        wrap.insertAdjacentHTML('afterend', html);
        let alertId = document.getElementById(drawAlertId);
        alertId.classList.add('now_open');
        alertId.style.cssText = 'z-index:' + zIdx +'';
        if( !body.classList.contains('.pop_on') ){//전체레이아웃 스크롤 막기
            body.classList.add('pop_on');
            wrap.setAttribute('aria-hidden', 'true');
        }
        alertId.focus();
        

        //확인버튼 이벤트
        alertId.querySelector('.btn_alert').addEventListener('click', (e) => {
            e.preventDefault();
            layerInfo.close(drawAlertId, callback);
            return false;
        });
        layerPopup.focus(drawAlertId);
        return false;
    },
    alertHtml : function(title, contents, id){
        return `
            <div class="popup_wrap alert" id="${id}" data-Type="alert" tabindex="-1" role="alert" aria-modal="true" style="opacity:1; z-index:99999;">
                <div class="dim"></div>
                <div class="popup_layer">
                    <div class="pop">
                        <div class="pop_cont">
                            <div class="pop_txt_info">
                                <p>${contents}</p>
                                <strong>${title}</strong>
                            </div>
                            <div class="btn_area flex">
                                <button type="button" class="btn btn_c1 btn_s4 btn_alert">확인</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },
    /**
     * confirm
     *
     * @param1 : title : confirm의 제목 : 없을 경우 ''
     * @param2 : contents : confirm의 내용 : 경로메세지(ex. 이름은 필수값 입니다.)
     * @param3 : yesCallback : 함수 : confirm의 '예' 버튼 클릭 후 전달되는 콜백
     * @param4 : noCallback : 함수 : confirm의 '아니오' 버튼 클릭 후 전달되는 콜백
     */
    confirmOpen : function(type, title, contents, yesCallback, noCallback){
        let wrap = document.querySelector('.wrap');
        let eTarget = event.target;
        eTarget.setAttribute('data-focus','on');

        if (title.indexOf('\n') >= 0) {
            title = title.replace(/\n/gi, '<br>');
        } else if (!contents) {
            title = "";
        }

        if (contents.indexOf('\n') >= 0) {
            contents = contents.replace(/\n/gi, '<br>');
        } else if (!contents) {
            contents = "";
        }

        let shownAlertLength = document.querySelectorAll('[data-Type="confirm"]').length + 1;

        let html = this.confirmHtml(type, 'pop_comfirm' + shownAlertLength, title, contents);
        let drawConfirmId = 'pop_comfirm' + shownAlertLength;

        /**
         *  2중 팝업시 마지막 팝업 상위 지정
         **/
        var layerWrapCnt = 0;
        var zIdx = 999999;
        if (!!event) {
			layerWrapCnt = document.getElementsByClassName('popup_wrap').length;
            if (layerWrapCnt > 0) {
                zIdx = zIdx + 1;
            }
        }

        wrap.insertAdjacentHTML('afterend', html);
        let comfirmId = document.getElementById(drawConfirmId);
        comfirmId.classList.add('now_open');
        comfirmId.style.zIndex = zIdx;
        comfirmId.focus();


        //'아니오', '취소' 버튼 이벤트
        comfirmId.querySelector('.btn_confirm_no').addEventListener('click', (e) => {
            e.preventDefault();
            layerInfo.close(drawConfirmId, noCallback);
            return false;
        });
        //'예', '확인' 버튼 이벤트
        comfirmId.querySelector('.btn_confirm_yes').addEventListener('click', (e) => {
            e.preventDefault();
            layerInfo.close(drawConfirmId, yesCallback);
            return false;
        });
        layerPopup.focus(drawConfirmId);
        return false;
    },
    confirmHtml : function(type, id, title, contents){
        let buttons = type == '1' ?
            '<button type="button" class="btn btn_c7 btn_t2 btn_s4 btn_confirm_no">취소</button><button type="button" class="btn btn_c1 btn_s4 btn_confirm_yes">확인</button>' :
            '<button type="button" class="btn btn_c7 btn_t2 btn_s4 btn_confirm_no">아니오</button><button type="button" class="btn btn_c1 btn_s4 btn_confirm_yes">예</button>';

        return `
            <div class="popup_wrap alert" id="${id}" data-Type="confirm" tabindex="-1" role="alertdialog" aria-modal="true" style="opacity:1; z-index:99999;">
                <div class="dim"></div>
                <div class="popup_layer">
                    <div class="pop">
                        <div class="pop_cont">
                            <div class="pop_txt_info">
                                <p>${contents}</p>
                                <strong>${title}</strong>
                            </div>
                            <div class="btn_area flex">
                                ${buttons}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },
    close : function(layerId, callback){
        let body = document.querySelector('body');
        let wrap = document.querySelector('.wrap');
        document.getElementById(layerId).remove();
        let popLength = document.querySelectorAll('.now_open').length;
        if (popLength < 1) {
            body.classList.remove('pop_on')
            wrap.setAttribute('aria-hidden', 'false');
        }
        restoreFocus();
        if(typeof callback === "function") {
            callback();
        }
    }
};
function showToast(message) {
    let toast = document.getElementById('toast');
    let toastMessage;

    // 없으면 생성
    if (!toast) {
        const toastHtml = `
            <div id="toast" role="alert" aria-live="assertive" aria-atomic="true" class="toast" hidden>
                <div class="toast_message" id="toast_msg"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        toast = document.getElementById('toast');
    }

    toastMessage = document.getElementById('toast_msg');

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    toast.hidden = false;            // ✅ 보이게 하기
    toast.classList.add('show');     // ✅ 애니메이션 효과

    // 토스트 자동 닫기
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.hidden = true;
        }, 400);
    }, 3000);
}

  
function selectPopup() {
    // 모든 .btn-sel 버튼에 대해 클릭 이벤트 리스너 추가
    document.querySelectorAll('.btn_sel').forEach(function (btnSel) {
        btnSel.addEventListener('click', function (event) {
            const wrap = document.querySelector('.wrap');
            const body = document.querySelector('body');
            const targetSel = btnSel.previousElementSibling; // 선택된 버튼의 이전 요소(select 요소)를 가져옴
            const selectValue = targetSel.value; // 현재 선택된 값
            let selectDisabled = targetSel.disabled; // select 요소가 비활성화되었는지 확인

            // select 요소가 비활성화되지 않은 경우에만 팝업을 열도록 처리
            if (!selectDisabled) {
                const selectLabel = btnSel.closest('.inp_item').querySelector('label').innerText; // 레이블 텍스트 가져오기
                btnSel.setAttribute('data-focus', 'on'); // 팝업이 닫힐 때 포커스를 되돌리기 위해 데이터 속성 추가

                // 팝업의 HTML 구조 정의
                let popupHtml = `
                    <div class="popup_wrap ty3 pop_sel" id="selList" tabindex="-1" role="dialog" aria-modal="true" style="opacity:1; z-index:11000;">
                        <div class="dim" tabindex="0"></div>
                        <div class="popup_layer">
                            <div class="pop" role="document">
                                <div class="pop_head">
                                    <h1>${selectLabel}</h1>
                                </div>
                                <div class="pop_cont sel_cont">
                                    <ul class="sel_group">
                                        ${Array.from(targetSel.options).map((option, i) => {
                                            if (i === 0) return ''; // 첫 번째 옵션은 생략
                                            return `
                                                <li class="inp_check sel_radio">
                                                    <input type="radio" name="sel_radio" id="sel_radio_${i}" value="${option.value}" ${option.value === selectValue ? 'checked' : ''} />
                                                    <label for="sel_radio_${i}" tabindex="0" class="chk_label"><span class="label_cont">${option.innerHTML}</span></label>
                                                </li>`;
                                        }).join('')}
                                    </ul>
                                </div>
                                <div class="btn_area flex">
                                    <button type="button" class="btn btn_c1 btn_s5 sel_ok">
                                        확인
                                    </button>
                                </div>
                                <a href="javascript:;" class="sel_close"><span class="blind">select 닫기</span></a>
                            </div>
                        </div>
                    </div>`;
                
                // 팝업 HTML을 DOM에 추가
                wrap.insertAdjacentHTML('afterend', popupHtml);
                const popTarget = document.querySelector('.pop_sel');
                const targetDim = popTarget.querySelector('.dim');
                const closeBtn = popTarget.querySelector('.sel_close');
                const selOk = popTarget.querySelector('.sel_ok');
                const toast = document.querySelector('#toast');

                // select 요소가 비활성화되지 않은 경우에만 팝업 활성화
                if (targetSel.getAttribute('disabled') !== 'disabled') {
                    body.classList.add('pop_on'); // 배경 스크롤 방지
                    popTarget.classList.add('now_open'); // 팝업 활성화
                    const firstRadio = popTarget.querySelector('input[name="sel_radio"]');
                    firstRadio.focus(); // 첫 번째 라디오 버튼에 포커스
                }

                // 확인 버튼 클릭 시 선택된 값을 반영하는 함수
                selOk.addEventListener('click', handleSelection);
                function handleSelection(event) {
                    const selectedRadio = popTarget.querySelector('input[name="sel_radio"]:checked');
                    
                    // 선택된 값이 없는 경우 토스트 팝업을 표시
                    if (!selectedRadio) {
                        showToast('하나를 선택해주세요.');
                        return;
                    }
                    
                    if (selectedRadio) {
                        const radioValue = selectedRadio.value;
                        const radioText = selectedRadio.nextElementSibling.textContent; // 선택된 라벨 텍스트 가져오기
                        const oldVal = targetSel.value;
                        targetSel.value = radioValue; // 새로운 값을 select 요소에 반영
                        const newVal = targetSel.value;

                        // 버튼에 선택된 값 반영 (여기에서 버튼 텍스트 업데이트)
                        const hideSpan = btnSel.querySelector('.blind');
                        if (hideSpan) {
                            hideSpan.textContent = radioText;
                        } else {
                            console.warn('btnSel 내부에 .ft-hide 요소가 없습니다.');
                        }
                        btnSel.setAttribute('aria-label', `${radioText} 선택 `); // 접근성 향상

                        // 값이 변경된 경우 change 이벤트 트리거
                        if (oldVal != newVal) {
                            const changeFn = targetSel.getAttribute("change");
                            if (changeFn == null) {
                                const event  = new Event('change', {bubbles: true});
                                targetSel.dispatchEvent(event);
                            }
                            if (changeFn != null && typeof window[changeFn] === "function") {
                                window[changeFn]();
                            }
                        }
                        closePopup(); // 팝업 닫기
                    }
                }

                // dim 영역이나 닫기 버튼 클릭 시 팝업 닫기
                targetDim.addEventListener('click', closePopup);
                closeBtn.addEventListener('click', closePopup);

                // Esc 키를 눌렀을 때 팝업 닫기
                document.addEventListener('keydown', function (event) {
                    if (event.key === 'Escape') {
                        closePopup();
                    }
                });

                // 팝업을 닫는 함수
                function closePopup() {
                    body.classList.remove('pop_on'); // 배경 스크롤 해제
                    popTarget.remove(); // 팝업 DOM 요소 제거
                    restoreFocus();
                    toast.remove();
                };

                layerPopup.focus('selList'); // 레이어 팝업 포커스 관리
                return false;
            }
        });
    });
}
  
function restoreFocus() {
  const dataFocus = document.querySelector('[data-focus="on"]');
  if (dataFocus) {
    dataFocus.focus(); // 이전 포커스로 되돌리기
    setTimeout(() => dataFocus.removeAttribute("data-focus"), 500);
  }
}
