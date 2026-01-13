document.addEventListener('DOMContentLoaded', function () {
  // DOM이 완전히 로드되면 삭제 버튼 초기화 실행
  initInputClearButtons();
  initTextareaLimit();// .inp_item textarea 기준 자동 적용
  toggleAccordion('.acd_wrap', true); // 두 번째 인자를 false로 하면 단일 열림만 허용
  initAccessibleTabs();
});

/**
 * 모든 .inp input을 순회하면서
 * "삭제 버튼이 필요한 input"만 골라 세팅한다
 */
function initInputClearButtons() {
  // .inp 내부에 있는 input만 대상
  const inputs = document.querySelectorAll('.inp input');

  inputs.forEach((input) => {
    const type = input.getAttribute('type');

    // 삭제 버튼을 허용할 input 타입
    const isTextType = ['text', 'number', 'tel', 'search'].includes(type);

    // textarea wrapper 안에 있는 경우
    const isTextarea = input.closest('.textarea');

    // select 스타일 input (삭제 버튼 제외 대상)
    const isSelect = input.classList.contains('select');

    /**
     * ✅ 삭제 버튼을 처음부터 만들어야 하는 조건
     * - text 계열이거나 textarea 이고
     * - select 타입이 아니며
     * - 현재 value가 비어있지 않을 때
     */
    const shouldRenderDelBtn =
      ((isTextType && !isSelect) || isTextarea) &&
      input.value.trim() !== "";

    // 페이지 로딩 시 이미 값이 있다면 버튼 생성
    if (shouldRenderDelBtn) {
      setupDeleteButton(input);
    }

    /**
     * 사용자가 입력해서 value가 생겼을 때
     * → 아직 del 버튼이 없으면 새로 생성
     */
    input.addEventListener('input', () => {
      const hasDelBtn = input.nextElementSibling?.classList.contains('del');
      if (input.value.trim() !== "" && !hasDelBtn) {
        setupDeleteButton(input);
      }
    });
  });
}

/**
 * 특정 input에 삭제 버튼을 붙이고
 * focus / value 상태에 따라 on 클래스를 관리한다
 */
function setupDeleteButton(input) {
  // 이미 삭제 버튼이 있으면 중복 생성 방지
  if (input.nextElementSibling?.classList.contains('del')) return;

  // input 바로 뒤에 삭제 버튼 삽입
  input.insertAdjacentHTML(
    'afterend',
    `<button type="button" class="btn del" tabindex="-1">
       <span class="blind">텍스트 삭제</span>
     </button>`
  );

  const delBtn = input.nextElementSibling;

  /**
   * 삭제 버튼의 활성화(on) 여부를 판단하는 함수
   * - input이 포커스 상태
   * - input에 값이 있음
   * → 둘 다 만족할 때만 on
   */
  const updateBtnState = () => {
    const hasFocus = document.activeElement === input;
    const hasValue = input.value !== "";

    if (hasFocus && hasValue) {
      delBtn.classList.add('on');
    } else {
      delBtn.classList.remove('on');
    }
  };

  // 생성 직후 상태 한 번 체크
  updateBtnState();

  // 비활성/읽기전용이면 이벤트 연결 안 함
  if (!input.disabled && !input.readOnly) {
    // 입력 시 값 변화 반영
    input.addEventListener('input', updateBtnState);

    // 포커스 들어오면 on 판단
    input.addEventListener('focusin', updateBtnState);

    // 포커스 나가면 살짝 지연 후 상태 제거
    input.addEventListener('focusout', () => {
      setTimeout(updateBtnState, 100);
    });

    /**
     * 삭제 버튼 클릭 시 동작
     * - input 값 비우기
     * - del 버튼 DOM 자체 제거
     * - 다시 input에 포커스
     */
    const clearInput = (e) => {
      e.preventDefault();

      // 값 제거
      input.value = "";

      // 버튼 자체를 DOM에서 제거
      delBtn.remove();

      // UX를 위해 다시 포커스
      setTimeout(() => input.focus(), 50);
    };

    // 모바일, 데스크탑 모두 안정적으로 동작하도록
    delBtn.addEventListener('mousedown', clearInput);
    delBtn.addEventListener('click', clearInput);
  }
}

/**
 * 텍스트영역에 글자 수 또는 바이트 수 제한 및 실시간 카운터 표시
 * 
 * @param {string} selector - 대상 textarea 선택자 (기본값: '.inp_item textarea')
 */
function initTextareaLimit(selector = '.inp_item textarea') {
  // 선택한 textarea 요소들을 모두 가져옴
  const textareas = document.querySelectorAll(selector);

  textareas.forEach(textarea => {
    // textarea와 같은 .inp_item 내에 있는 .counter 요소 찾기
    const counterWrap = textarea.closest('.inp_item')?.querySelector('.counter');
    const em = counterWrap?.querySelector('em'); // 실시간 카운트 표시할 <em>
    const max = parseInt(counterWrap?.querySelector('.max')?.textContent || '0', 10); // 최대 글자/바이트 수

    // counter 관련 요소가 없거나 max가 유효하지 않으면 무시
    if (!counterWrap || !em || !max) return;

    // .byte 클래스가 있으면 바이트 단위 체크, 없으면 글자 수 체크
    const isByte = counterWrap.classList.contains('byte');

    // textarea 입력 이벤트 감지
    textarea.addEventListener('input', () => {
      let value = textarea.value;
      let count = 0;

      if (isByte) {
        // ✅ 바이트 수 체크 로직 (한글, 이모지 등 2바이트 문자 포함)
        let total = 0, len = 0;
        for (let i = 0; i < value.length; i++) {
          // escape로 인코딩했을 때 길이가 4 초과면 2바이트, 아니면 1바이트
          const byte = escape(value[i]).length > 4 ? 2 : 1;
          if (total + byte > max) break; // 최대값 초과 시 중단
          total += byte;
          len++;
        }
        value = value.slice(0, len);     // 허용 범위 내로 잘라냄
        textarea.value = value;          // 잘라낸 값을 다시 설정
        count = total;                   // 실제 바이트 수
      } else {
        // ✅ 글자 수 체크
        if (value.length > max) {
          value = value.slice(0, max);   // 최대 글자 수 초과 시 자름
          textarea.value = value;
        }
        count = value.length;            // 현재 글자 수
      }

      // 카운터 숫자 업데이트
      em.textContent = count;
    });
  });
}
function initAccessibleTabs(containerSelector = '.tab_wrap') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const tabs = container.querySelectorAll('[role="tab"]');
  const panels = container.querySelectorAll('[role="tabpanel"]');

  // ✅ 탭 활성화 함수
  function activateTab(tab) {
    const targetId = tab.getAttribute('aria-controls');

    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
      t.classList.remove('active');
    });

    panels.forEach(p => {
      p.classList.remove('active');
      p.setAttribute('hidden', 'true');
    });

    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    tab.classList.add('active');
    tab.focus();

    const targetPanel = container.querySelector(`#${targetId}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
      targetPanel.removeAttribute('hidden');
    }
  }

  // ✅ 클릭 이벤트 핸들러
  function handleClick(event) {
    activateTab(event.currentTarget);
  }

  // ✅ 키보드 이벤트 핸들러
  function handleKeydown(event) {
    const tab = event.currentTarget;
    const tabsArray = Array.from(tabs);
    let newIndex = tabsArray.indexOf(tab);

    if (event.key === 'ArrowRight') {
      newIndex = (newIndex + 1) % tabsArray.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (newIndex - 1 + tabsArray.length) % tabsArray.length;
    } else {
      return;
    }

    event.preventDefault();
    activateTab(tabsArray[newIndex]);
  }

  // ✅ 이벤트 등록
  tabs.forEach(tab => {
    tab.addEventListener('click', handleClick);
    tab.addEventListener('keydown', handleKeydown);
  });

  // ✅ 초기 활성화 탭이 없을 경우 첫 번째 탭 활성화
  const selected = Array.from(tabs).find(t => t.getAttribute('aria-selected') === 'true');
  activateTab(selected || tabs[0]);
}


/**
 * 아코디언 토글 기능을 여러 래퍼에 적용하는 함수
 * @param {string} wrapperSelector - 아코디언을 감싸는 래퍼 선택자 (기본값: '.acd_wrap')
 * @param {boolean} allowMultiple - 다중 아코디언 열림 허용 여부 (기본값: true)
 */
function toggleAccordion(wrapperSelector = '.acd_wrap', allowMultiple = true) {
  // 지정한 선택자에 해당하는 모든 아코디언 래퍼를 찾음
  const wrappers = document.querySelectorAll(wrapperSelector);
  if (!wrappers.length) return; // 래퍼가 없으면 종료

  // 각 아코디언 래퍼마다 개별 처리
  wrappers.forEach(wrapper => {
    // 아코디언 버튼(.acd_btn)을 모두 선택
    const buttons = wrapper.querySelectorAll('.acd_btn');

    buttons.forEach((btn) => {
      // 버튼 클릭 시 동작할 이벤트 리스너 등록
      btn.addEventListener('click', () => {
        const item = btn.closest('.acd_item'); // 클릭된 버튼이 속한 아코디언 항목
        const inner = item.querySelector('.acd_cont'); // 아코디언 내용 영역
        const isActive = item.classList.contains('active'); // 현재 열려 있는 상태인지 확인

        // aria-expanded 속성 업데이트 (접근성 대응)
        btn.setAttribute('aria-expanded', isActive ? 'false' : 'true');

        // 다중 열림 비허용 설정일 경우
        if (!allowMultiple) {
          // 현재 클릭된 항목을 제외한 모든 열려있는 아코디언 닫기
          wrapper.querySelectorAll('.acd_item.active').forEach((activeItem) => {
            if (activeItem !== item) {
              activeItem.classList.remove('active'); // active 클래스 제거
              const otherBtn = activeItem.querySelector('.acd_btn'); // 해당 항목의 버튼
              if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false'); // aria-expanded 갱신
            }
          });
        }

        // 현재 아코디언 항목을 토글 (열기/닫기)
        item.classList.toggle('active');
      });
    });
  });
}
