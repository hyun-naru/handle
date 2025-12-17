document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------
  // 1. 탭 선택 상태 제어 (.menuWrap dt)
  // --------------------------------
  const tabHeaders = document.querySelectorAll('.menuWrap dt');
  tabHeaders.forEach((dt) => {
    dt.addEventListener('click', () => {
      tabHeaders.forEach((other) => {
        other.classList.remove('selected');
      });
      dt.classList.add('selected');
    });
  });

  // --------------------------------
  // 2. 여러 개의 .js-menu-table 처리
  // --------------------------------
  const tables = document.querySelectorAll('.js-menu-table');

  tables.forEach((table) => {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));

    // 이 테이블 안의 select들 (id 대신 class 기반)
    const depth1Sel   = table.querySelector('.js-depth1');   // D1
    const depth2Sel   = table.querySelector('.js-depth2');   // D2
    const ownerSel    = table.querySelector('.js-owner');    // 담당
    const dDayDateSel = table.querySelector('.js-day-date');  // 완료일
    const edDateSel   = table.querySelector('.js-ed-date');  // 완료일
    const mdDateSel   = table.querySelector('.js-md-date');  // 수정일

    // --- thead 안에서 각 class의 th가 몇 번째인지 구해두기 ---
    const headerThs = Array.from(table.querySelectorAll('thead th'));
    const d1Idx     = headerThs.findIndex((th) => th.classList.contains('depth1'));
    const d2Idx     = headerThs.findIndex((th) => th.classList.contains('depth2'));
    const ownerIdx  = headerThs.findIndex((th) => th.classList.contains('owner'));
    const dDayIdx   = headerThs.findIndex((th) => th.classList.contains('day-date'));
    const edIdx     = headerThs.findIndex((th) => th.classList.contains('ed-date'));
    const mdIdx     = headerThs.findIndex((th) => th.classList.contains('md-date'));

    // -------------------------------
    // 1. D1 / D2 / 담당 / 완료일 / 수정일 데이터 수집
    // -------------------------------
    const menuData     = {};  // { seq1: { name: 'D1', children: { seq2: 'D2' } } }
    const ownerList    = [];
    const dDayDateList = [];
    const edDateList   = [];
    const mdDateList   = [];

    let depth1Text = '';
    let depth1Seq  = '';
    let depth2Text = '';
    let depth2Seq  = '';

    rows.forEach((tr, index) => {
      const tds = tr.querySelectorAll('td');

      // D1, D2
      const d1Cell = d1Idx >= 0 ? tds[d1Idx] : null;
      const d2Cell = d2Idx >= 0 ? tds[d2Idx] : null;

      if (d1Cell && d1Cell.textContent.trim() !== '') {
        depth1Text = d1Cell.textContent.trim();
        depth1Seq  = String(index);

        if (!menuData[depth1Seq]) {
          menuData[depth1Seq] = { name: depth1Text, children: {} };
        } else {
          menuData[depth1Seq].name = depth1Text;
        }
      }

      if (d2Cell && d2Cell.textContent.trim() !== '') {
        depth2Text = d2Cell.textContent.trim();
        depth2Seq  = String(index);
      }

      // 담당자
      if (ownerIdx >= 0 && tds[ownerIdx]) {
        const ownerSpan = tds[ownerIdx].querySelector('span');
        const owner = ownerSpan ? ownerSpan.textContent.trim() : '';
        if (owner) {
          if (!ownerList.includes(owner)) ownerList.push(owner);
          tr.dataset.owner = owner;
        }
      }

      // 완료예정일
      if (dDayIdx >= 0 && tds[dDayIdx]) {
        const dDaySpan = tds[dDayIdx].querySelector('span');
        const dDayDate = dDaySpan ? dDaySpan.textContent.trim() : '';
        if (dDayDate) {
          if (!dDayDateList.includes(dDayDate)) dDayDateList.push(dDayDate);
          tr.dataset.dDayDate = dDayDate;
        }
      }
      // 완료일
      if (edIdx >= 0 && tds[edIdx]) {
        const edSpan = tds[edIdx].querySelector('span');
        const edDate = edSpan ? edSpan.textContent.trim() : '';
        if (edDate) {
          if (!edDateList.includes(edDate)) edDateList.push(edDate);
          tr.dataset.edDate = edDate;
        }
      }

      // 수정일
      if (mdIdx >= 0 && tds[mdIdx]) {
        const mdSpans = tds[mdIdx].querySelectorAll('span');
        const dates = [];
        mdSpans.forEach((span) => {
          const mdDate = span.textContent.trim();
          if (mdDate) {
            dates.push(mdDate);
            if (!mdDateList.includes(mdDate)) mdDateList.push(mdDate);
          }
        });

        // 쉼표로 연결하여 data 속성에 저장
        if (dates.length > 0) {
          tr.dataset.mdDate = dates.join(',');
        }
      }

      // depth 관련 data-* 저장
      tr.dataset.seq1   = depth1Seq;
      tr.dataset.depth1 = depth1Text;
      tr.dataset.seq2   = depth2Seq;
      tr.dataset.depth2 = depth2Text;
    });

    // D1별 D2 children 구성
    rows.forEach((tr) => {
      const seq1 = tr.dataset.seq1;
      const seq2 = tr.dataset.seq2;
      const d2   = tr.dataset.depth2;

      if (!seq1 || !menuData[seq1]) return;
      if (!menuData[seq1].children) {
        menuData[seq1].children = {};
      }
      menuData[seq1].children[seq2] = d2;
    });

    // 정렬
    ownerList.sort();
    dDayDateList.sort();
    edDateList.sort();
    mdDateList.sort();

    // -------------------------------
    // 2. No 컬럼 추가 (colgroup + thead + 각 tr 앞에)
    // -------------------------------
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const noCol = document.createElement('col');
      noCol.style.width = '40px';
      colgroup.insertBefore(noCol, colgroup.firstChild);
    }

    const theadFirstRow = table.querySelector('thead tr');
    if (theadFirstRow && !theadFirstRow.querySelector('.js-no-header') && !theadFirstRow.querySelector('.pageNumber')) {
      const th = document.createElement('th');
      th.className = 'js-no-header';
      th.setAttribute('scope', 'col');
      th.style.borderRight = '1px solid #ccc';
      th.textContent = 'No';
      theadFirstRow.insertBefore(th, theadFirstRow.firstChild);
    }

    rows.forEach((tr, index) => {
      if (!tr.querySelector('.td-no') && !theadFirstRow.querySelector('.pageNumber')) {
        const tdNo = document.createElement('td');
        tdNo.className = 'td-no';
        tdNo.style.fontWeight = 'bold';
        tdNo.style.textAlign = 'center';
        tdNo.textContent = String(index + 1);
        tr.insertBefore(tdNo, tr.firstChild);
      }
    });

    // -------------------------------
    // 3. select 옵션 채우기
    // -------------------------------
    const buildOptions = (list, withEmpty = true) => {
      const arr = [];
      if (withEmpty) arr.push('<option value="">선택</option>');
      list.forEach((v) => arr.push(`<option value="${v}">${v}</option>`));
      return arr.join('');
    };

    // D1
    if (depth1Sel) {
      const opts = ['<option value="">선택</option>'];
      Object.keys(menuData).forEach((key) => {
        if (menuData[key] && menuData[key].name) {
          opts.push(`<option value="${key}">${menuData[key].name}</option>`);
        }
      });
      depth1Sel.innerHTML = opts.join('');
    }

    // 담당
    if (ownerSel) {
      ownerSel.innerHTML = buildOptions(ownerList, true);
    }

    // 완료일
    if (dDayDateSel) {
      dDayDateSel.innerHTML = buildOptions(dDayDateList, true);
    }
    // 완료일
    if (edDateSel) {
      edDateSel.innerHTML = buildOptions(edDateList, true);
    }

    // 수정일
    if (mdDateSel) {
      mdDateSel.innerHTML = buildOptions(mdDateList, true);
    }

    // -------------------------------
    // 4. 필터 적용 함수
    // -------------------------------
    const applyFilters = () => {
      const depth1Val = depth1Sel ? depth1Sel.value : '';
      const depth2Val = depth2Sel ? depth2Sel.value : '';
      const ownerVal  = ownerSel  ? ownerSel.value  : '';
      const dDayVal   = dDayDateSel ? dDayDateSel.value : '';
      const edVal     = edDateSel ? edDateSel.value : '';
      const mdVal     = mdDateSel ? mdDateSel.value : '';

      rows.forEach((tr) => {
        let show = true;

        if (depth1Val) {
          show = show && tr.dataset.seq1 === depth1Val;
        }
        if (depth2Val) {
          show = show && tr.dataset.seq2 === depth2Val;
        }
        if (ownerVal) {
          show = show && tr.dataset.owner === ownerVal;
        }
        if (edVal) {
          show = show && tr.dataset.edDate === edVal;
        }
        if (dDayVal) {
          show = show && tr.dataset.dDayDate === dDayVal;
        }
        if (mdVal) {
          const trMdDates = tr.dataset.mdDate || '';
          const mdDatesArr = trMdDates.split(',');
          show = show && mdDatesArr.includes(mdVal);
        }

        tr.style.display = show ? '' : 'none';
      });
    };

    // -------------------------------
    // 5. 이벤트 바인딩 (D1 / D2 / 담당 / 완료일 / 수정일)
    // -------------------------------
    if (depth1Sel && depth2Sel) {
      depth1Sel.addEventListener('change', () => {
        const val = depth1Sel.value;

        if (val && menuData[val] && menuData[val].children) {
          const children = menuData[val].children;
          const opts = ['<option value="">선택</option>'];

          Object.keys(children).forEach((k) => {
            const label = children[k];
            if (label) {
              opts.push(`<option value="${k}">${label}</option>`);
            }
          });

          depth2Sel.innerHTML = opts.join('');
        } else {
          depth2Sel.innerHTML = '<option value="">선택</option>';
        }

        applyFilters();
      });

      depth2Sel.addEventListener('change', applyFilters);
    }

    if (ownerSel) {
      ownerSel.addEventListener('change', applyFilters);
    }
    if (dDayDateSel) {
      dDayDateSel.addEventListener('change', applyFilters);
    }
    if (edDateSel) {
      edDateSel.addEventListener('change', applyFilters);
    }
    if (mdDateSel) {
      mdDateSel.addEventListener('change', applyFilters);
    }
    // URL 컬럼 index 찾기
    const urlTh = table.querySelector('thead th.url');
    const urlIdx = Array.from(table.querySelectorAll('thead th')).indexOf(urlTh);

    // iframe 생성 후 body에 추가
    const iframe = document.createElement('iframe');
    iframe.className = 'previewIframe';
    iframe.id = 'ifrm';
    document.body.appendChild(iframe);

    // 각 row의 URL 셀 선택
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      const urlCell = tds[urlIdx];
      if (!urlCell) return;

      const link = urlCell.querySelector('a');
      if (!link) return;

      // .delete 클래스 포함된 행은 제외
      if (link.closest('.delete')) return;

      // mouseover
      link.addEventListener('mouseover', () => {
        iframe.style.display = 'block';
        iframe.src = link.getAttribute('href');

        // 내부 iframe 로딩 후 wrap scale 조정
        setTimeout(() => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const wrap = iframeDoc.querySelector('.wrap');
            if (wrap) {
              wrap.style.transform = 'scale(1)';
              wrap.style.transformOrigin = '0 0';
            }
          } catch (e) {
            console.warn('iframe 내부에 접근 불가:', e);
          }
        }, 200);
      });

      // mouseout
      link.addEventListener('mouseout', () => {
        iframe.style.display = 'none';
      });
    });

  });
});





// UI 가이드 페이지 기능 스크립트: 복사 버튼, 섹션 이동, 탭 추가 등 유틸 도구 모음

let sectionArry = [];

// ✅ 복사 버튼 생성 및 클립보드 복사 기능 초기화
function guideCopyInit() {
  $('.guideComponent').each(function () {
    const $comp = $(this);
    let btnNum = $comp.children().length;

    if (btnNum === 0) $comp.addClass('empty');
    if ($comp.hasClass('all')) btnNum = 1;

    for (let i = 0; i < btnNum; ++i) {
      if ($comp.prev().is('h2') && !$comp.children().eq(i).hasClass('noCopy')) {
        const btnHTML = '<button type="button" class="guideCopyBtn"><span class="blind"></span></button>';
        $comp.prev().append(btnHTML);

        const $btn = $comp.prev().find('.guideCopyBtn').last();

        // 복사할 HTML 설정
        if (!$comp.hasClass('all')) {
          $btn.data('comp', $comp.children().eq(i)[0].outerHTML);
        } else {
          let strHTML = '';
          $comp.children().each(function () {
            const $el = $(this);
            if (!$el.hasClass('noCopy')) {
              strHTML += !$el.hasClass('hiddenParent') ? $el[0].outerHTML : $el.children()[0].outerHTML;
            }
          });
          $btn.data('comp', strHTML);
        }

        // 복사 이벤트 바인딩
        $btn.on('click', function () {
          copyToClipboard($(this).data('comp'));
        });
      }
    }
  });

  // ✅ 클립보드 복사
  function copyToClipboard(val) {
    const t = document.createElement('textarea');
    document.body.appendChild(t);
    t.value = val;
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    clipboardAlert();
  }

  // ✅ 클립보드 복사 알림
  function clipboardAlert(msg = '클립보드에 저장하였습니다', time = 500) {
    if ($('.alert_wrap').length === 0) {
      onlyAlertMake(msg);
      setTimeout(() => {
        $('.alert_wrap').fadeOut(() => $(this).remove());
      }, time);
    }
  }

  // ✅ 알림 UI 렌더링
  function onlyAlertMake(msg) {
    const str = `
      <div class="alert_wrap">
        <div class="alert_pop">
          <div class="alert_cont">
            <div class="msg">${msg}</div>
          </div>
        </div>
      </div>`;
    $('body').append(str);
    $('.alert_wrap').hide().fadeIn(200);
  }
}

// ✅ 섹션 이동 내비게이션 생성 및 바인딩
function sectionMoveInit() {
  getSeiction();
  sectionArry.forEach(([id, title], i) => {
    const txt = title.replace('Guide', '');
    $('.guide_location').append(`<div></div><a href="#${id}" class="guide_list">${txt}</a>`);
  });

  // 클릭 시 섹션 이동
  $('.guide_list').on('click', function (e) {
    e.preventDefault();
    const id = $(this).attr('href').replace('#', '');
    if ($(`#${id}`).length > 0) {
      let posY = $(`#${id}`).offset().top - 57;
      if ($(this).index() === 1) posY = 155;
      $('html, body').animate({ scrollTop: posY }, 300);
    }
  });
}

// ✅ 섹션 ID + h1 제목 텍스트 추출
function getSeiction() {
  $('div.section').each(function () {
    const id = $(this).attr('id');
    if (id) {
      sectionArry.push([id, $(this).find('h1').first().text()]);
    }
  });
}

// ✅ 컴포넌트와 제목을 감싸는 구조 정리
function wrapSection() {
  $('.guideComponent').each(function () {
    $(this).after('<div class="compWrap"></div>');
  });
  $('.compWrap').each(function () {
    const $wrap = $(this);
    if ($wrap.prev().is('.guideComponent')) $wrap.prepend($wrap.prev());
    if ($wrap.prev().is('.tit02')) $wrap.prepend($wrap.prev());
  });
  $('html').addClass('ready');
}

// ✅ 기본 실행
$(document).ready(function () {
  guideCopyInit();
  setTimeout(() => {
    sectionMoveInit();
    wrapSection();
  }, 300);
});

// ✅ 샘플 alert 생성
function alertExample(txt) {
  const html = `
    <div class="popWrap" id="testAlert">
      <div class="popContain">
        <div class="popup alert">
          <div class="popBody">${String(txt)}</div>
          <div class="btn_wrap">
            <button type="button" class="btn_primary" onclick="lp.close();"><span>확인</span></button>
          </div>
        </div>
      </div>
    </div>`;
  $('body').append(html);
  lp.open('#testAlert');
}

// ✅ 탭 항목 추가 예제
let myTestNum = 3;
function addTabList(target) {
  const $li = $(target).closest('li');
  $li.before(`<li><a href="#">${myTestNum}차</a></li>`);
  $li.closest('.tabWrap')
    .find('.tabContents')
    .append(`<div class="tab_cont_list tabPanel">${myTestNum * 111111}</div>`);
  myTestNum++;
  if (myTestNum > 5) $('.tabWrap').removeClass('addTabWrap');
}
