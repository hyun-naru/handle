document.addEventListener('DOMContentLoaded', function () {
  initInputClearButtons();
});

/**
 * 입력 필드용 삭제 버튼 추가 및 상태 관리
 */
function initInputClearButtons() {
  const inputs = document.querySelectorAll('.inp input');

  inputs.forEach((input) => {
    const type = input.getAttribute('type');
    const isTextType = ['text', 'number', 'tel'].includes(type);
    const isTextarea = input.closest('.textarea');
    const isSelect = input.classList.contains('select');

   const shouldRenderDelBtn =
      ((isTextType && !isSelect) || isTextarea) &&
      input.value.trim() !== ""; // ✅ 값이 있는 경우만

     if (shouldRenderDelBtn) {
      setupDeleteButton(input);
    }

    // ✅ 이후 입력값이 생겼을 때 동적으로 버튼 추가
    input.addEventListener('input', () => {
      const hasDelBtn = input.nextElementSibling?.classList.contains('del');
      if (input.value.trim() !== "" && !hasDelBtn) {
        setupDeleteButton(input);
      }
    });
  });
}

/**
 * 삭제 버튼 추가 및 상태 이벤트 연결
 */
function setupDeleteButton(input) {
  if (input.nextElementSibling?.classList.contains('del')) return;

  input.insertAdjacentHTML(
    'afterend',
    `<button type="button" class="btn del" tabindex="-1"><span class="blind">텍스트 삭제</span></button>`
  );
  const delBtn = input.nextElementSibling;

  const updateBtnState = () => {
    const hasFocus = document.activeElement === input;
    const hasValue = input.value !== "";
    if (hasFocus && hasValue) {
      delBtn.classList.add('on');
    } else {
      delBtn.classList.remove('on');
    }
  };

  // ✅ 초기에도 검사
  updateBtnState();

  if (!input.disabled && !input.readOnly) {
    input.addEventListener('input', updateBtnState);
    input.addEventListener('focusin', updateBtnState);
    input.addEventListener('focusout', () => {
      setTimeout(updateBtnState, 100);
    });

    const clearInput = (e) => {
      e.preventDefault();
      input.value = "";
      // 값 없으면 버튼 자체 삭제
      delBtn.remove();

      // 포커스만 다시 돌려줌
      setTimeout(() => input.focus(), 50);
    };

    delBtn.addEventListener('mousedown', clearInput);
    delBtn.addEventListener('click', clearInput);
  }
}