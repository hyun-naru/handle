document.addEventListener('DOMContentLoaded', function () {
  // DOM이 완전히 로드되면 삭제 버튼 초기화 실행
  initInputClearButtons();
  initTextareaLimit();// .inp_item textarea 기준 자동 적용
  toggle();
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

    // 모바일 / 데스크탑 모두 안정적으로 동작하도록
    delBtn.addEventListener('mousedown', clearInput);
    delBtn.addEventListener('click', clearInput);
  }
}

function initTextareaLimit(selector = '.inp_item textarea') {
  const textareas = document.querySelectorAll(selector);

  textareas.forEach(textarea => {
    const counterWrap = textarea.closest('.inp_item')?.querySelector('.counter');
    const em = counterWrap?.querySelector('em');
    const max = parseInt(counterWrap?.querySelector('.max')?.textContent || '0', 10);

    if (!counterWrap || !em || !max) return;

    const isByte = counterWrap.classList.contains('byte');

    textarea.addEventListener('input', () => {
      let value = textarea.value;
      let count = 0;

      if (isByte) {
        // 바이트 체크 (2바이트 문자 포함)
        let total = 0, len = 0;
        for (let i = 0; i < value.length; i++) {
          const byte = escape(value[i]).length > 4 ? 2 : 1;
          if (total + byte > max) break;
          total += byte;
          len++;
        }
        value = value.slice(0, len);
        textarea.value = value;
        count = total;
      } else {
        // 글자 수 체크
        if (value.length > max) {
          value = value.slice(0, max);
          textarea.value = value;
        }
        count = value.length;
      }

      em.textContent = count;
    });
  });
}




function toggle() {
    // Accordion 객체를 정의하는 생성자 함수
    var Accordion = function (el, multiple) {
        this.el = el || {}; // 아코디언 리스트의 요소를 저장
        this.multiple = multiple || false; // 다중 열림을 허용할지 여부를 저장

        // 아코디언의 각 버튼 요소(.acd_btn)를 선택하고, aria-label 속성을 "열기"로 설정
        var links = this.el.find('.acd_btn');
        links.off().on('click', {el: this.el, multiple: this.multiple}, this.dropdown); // 클릭 이벤트 핸들러 설정
    };

    // 아코디언의 드롭다운 기능을 처리하는 메서드
    Accordion.prototype.dropdown = function (e) {
        var $el = e.data.el; // 아코디언 리스트의 요소
        ($this = $(this)), ($next = $this.next()); // 클릭된 버튼($this)과 다음 요소($next)를 저장

        $next.slideToggle(100); // 패널을 슬라이드 방식으로 열고 닫기
        $this.parent().toggleClass('active'); // 부모 요소에 active 클래스 토글

        // 다중 열림이 허용되지 않은 경우, 다른 패널을 닫기
        if (!e.data.multiple) {
            $el.find('.acd_cont').not($next).slideUp(100).parent().removeClass('active');
        }
    };

    // 아코디언 객체를 생성하고 초기화
    var accordion = new Accordion($('.acd_wrap'), true); // 다중 열림 허용
}