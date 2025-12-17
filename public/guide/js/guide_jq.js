$(document).ready(() => {
  $('.menuWrap dt').on('click', function(){
    const $tab = $(this);
    $('.menuWrap dt').removeClass('selected');
    $tab.addClass('selected');
  })
  // 여러 개의 .js-menu-table이 있어도 각각 자동 처리
  $('.js-menu-table').each(function () {
    const $table = $(this);
    const $tbody = $table.find('tbody');
    const $rows = $tbody.find('tr');
    // 이 테이블 안의 select들 (id 대신 class 기반)
    const $depth1Sel = $table.find('.js-depth1');   // D1
    const $depth2Sel = $table.find('.js-depth2');   // D2
    const $ownerSel  = $table.find('.js-owner');    // 담당
    const $dDayDateSel = $table.find('.js-day-date');  // 완료예정일
    const $edDateSel = $table.find('.js-ed-date');  // 완료일
    const $mdDateSel = $table.find('.js-md-date');  // 수정일

    // -------------------------------
    // 1. D1 / D2 / 담당 / 완료일 / 수정일 데이터 수집
    //    (⚠ No 컬럼 추가하기 전에, "원래" 인덱스 기준으로 읽음)
    // -------------------------------
    const menuData = {}; // { seq1: { name: 'D1', children: { seq2: 'D2' } } }
    const ownerList = [];
    const dDayDateList = [];
    const edDateList = [];
    const mdDateList = [];

    let depth1Text = '';
    let depth1Seq = '';
    let depth2Text = '';
    let depth2Seq = '';

    $rows.each(function (index) {
      const $tr = $(this);
      const $tds = $tr.find('td');

      // D1, D2
      const d1Idx = $table.find('thead th.depth1').index();
      const d2Idx = $table.find('thead th.depth2').index();
      const $d1 = $tds.eq(d1Idx); // D1
      const $d2 = $tds.eq(d2Idx); // D2

      if ($d1.text().trim() !== '') {
        depth1Text = $d1.text().trim();
        depth1Seq = index;
        if (!menuData[depth1Seq]) {
          menuData[depth1Seq] = { name: depth1Text, children: {} };
        } else {
          menuData[depth1Seq].name = depth1Text;
        }
      }

      if ($d2.text().trim() !== '') {
        depth2Text = $d2.text().trim();
        depth2Seq = index;
      }

      // 담당자
      const ownerIdx = $table.find('thead th.owner').index();
      const owner = $tds.eq(ownerIdx).find('span').text().trim();
      if (owner) {
        if (!ownerList.includes(owner)) ownerList.push(owner);
        $tr.attr('data-owner', owner);
      }

      // 완료일: td[6] span
      const dDayIdx = $table.find('thead th.day-date').index();
      const dDayDate = $tds.eq(dDayIdx).text().trim();
      if (dDayDate) {
        if (!dDayDateList.includes(dDayDate)) dDayDateList.push(dDayDate);
        $tr.attr('data-day-date', dDayDate);
      }

      // 완료일: td[6] span
      const edIdx = $table.find('thead th.ed-date').index();
      const edDate = $tds.eq(edIdx).text().trim();
      if (edDate) {
        if (!edDateList.includes(edDate)) edDateList.push(edDate);
        $tr.attr('data-ed-date', edDate);
      }

      // 수정일: td[7] span
      const mdIdx = $table.find('thead th.md-date').index();
      const $mdCell = $tds.eq(mdIdx);
      const mdDates = [];

      $mdCell.find('span').each(function () {
        const dateText = $(this).text().trim();
        if (dateText) {
          mdDates.push(dateText);
          if (!mdDateList.includes(dateText)) {
            mdDateList.push(dateText);
          }
        }
      });

      // 쉼표로 연결해서 data 속성에 저장
      if (mdDates.length > 0) {
        $tr.attr('data-md-date', mdDates.join(','));
      }


      // depth 관련 data-* 저장
      $tr.attr({
        'data-seq1': depth1Seq,
        'data-depth1': depth1Text,
        'data-seq2': depth2Seq,
        'data-depth2': depth2Text,
      });
    });

    // D1별 D2 children 구성
    $rows.each(function () {
      const $tr = $(this);
      const seq1 = $tr.attr('data-seq1');
      const seq2 = $tr.attr('data-seq2');
      const d2 = $tr.attr('data-depth2');

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
    // 2. 이제 No 컬럼 추가 (colgroup + thead + 각 tr 앞에)
    // -------------------------------
    const $colgroup = $table.find('colgroup');
    if ($colgroup.length) {
      $colgroup.prepend('<col style="width:40px" />');
    }

    const $theadFirstRow = $table.find('thead tr').first();
    if (!$theadFirstRow.find('.js-no-header').length && !$theadFirstRow.find('.pageNumber').length) {
      $theadFirstRow.prepend(
        '<th class="js-no-header" scope="col" rowspan="2" style="border-right:1px solid #ccc">No</th>',
      );
    }

    $rows.each(function (index) {
      const $tr = $(this);
      // 중복 방지
      if (!$tr.find('.td-no').length && !$theadFirstRow.find('.pageNumber').length) {
        $tr.prepend(
          `<td class="td-no" style="font-weight:bold;text-align:center;">${index + 1}</td>`,
        );
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
    if ($depth1Sel.length) {
      const opts = ['<option value="">선택</option>'];
      Object.keys(menuData).forEach((key) => {
        if (menuData[key] && menuData[key].name) {
          opts.push(`<option value="${key}">${menuData[key].name}</option>`);
        }
      });
      $depth1Sel.html(opts.join(''));
    }

    // 담당
    if ($ownerSel.length) {
      $ownerSel.html(buildOptions(ownerList, true));
    }

    // 완료일
    if ($dDayDateSel.length) {
      $dDayDateSel.html(buildOptions(dDayDateList, true));
    }

    // 완료일
    if ($edDateSel.length) {
      $edDateSel.html(buildOptions(edDateList, true));
    }

    // 수정일
    if ($mdDateSel.length) {
      $mdDateSel.html(buildOptions(mdDateList, true));
    }

    // -------------------------------
    // 4. 필터 적용 함수
    // -------------------------------
    const applyFilters = () => {
      const depth1Val = $depth1Sel.val() || '';
      const depth2Val = $depth2Sel.val() || '';
      const ownerVal  = $ownerSel.val()  || '';
      const dDayVal   = $dDayDateSel.val() || '';
      const edVal     = $edDateSel.val() || '';
      const mdVal     = $mdDateSel.val() || '';

      $rows.each(function () {
        const $tr = $(this);

        let show = true;

        if (depth1Val) {
          show = show && $tr.attr('data-seq1') === depth1Val;
        }
        if (depth2Val) {
          show = show && $tr.attr('data-seq2') === depth2Val;
        }
        if (ownerVal) {
          show = show && $tr.attr('data-owner') === ownerVal;
        }
        if (dDayVal) {
          show = show && $tr.attr('data-day-date') === dDayVal;
        }
        if (edVal) {
          show = show && $tr.attr('data-ed-date') === edVal;
        }
        if (mdVal) {
          const trMdDates = $tr.data('mdDate') || '';
          const mdDatesArr = trMdDates.split(',');
          show = show && mdDatesArr.includes(mdVal);
        }

        $tr.toggle(show);
      });
    };

    // -------------------------------
    // 5. D1 change → D2 옵션 재생성 + 필터 적용
    // -------------------------------
    if ($depth1Sel.length && $depth2Sel.length) {
      $depth1Sel.on('change', function () {
        const val = $(this).val();

        if (val && menuData[val] && menuData[val].children) {
          const children = menuData[val].children;
          const opts = ['<option value="">선택</option>'];

          Object.keys(children).forEach((k) => {
            const label = children[k];
            if (label) {
              opts.push(`<option value="${k}">${label}</option>`);
            }
          });

          $depth2Sel.html(opts.join(''));
        } else {
          $depth2Sel.html('<option value="">선택</option>');
        }

        applyFilters();
      });

      $depth2Sel.on('change', () => {
        applyFilters();
      });
    }

    // 담당 / 완료일 / 수정일 변경 시 필터 적용
    if ($ownerSel.length) {
      $ownerSel.on('change', applyFilters);
    }
    if ($dDayDateSel.length) {
      $dDayDateSel.on('change', applyFilters);
    }
    if ($edDateSel.length) {
      $edDateSel.on('change', applyFilters);
    }
    if ($mdDateSel.length) {
      $mdDateSel.on('change', applyFilters);
    }
    
    // 테이블 안에서 URL 컬럼(th.url)이 몇 번째인지 찾기
    const urlIdx = $table.find('thead th.url').index();

    // body, iframe 준비
    const $body = $('body');
    let $iframe = $('#ifrm');

    // iframe이 없으면 한 번만 생성해서 body에 추가
    if (!$iframe.length) {
      $iframe = $('<iframe class="previewIframe" id="ifrm"></iframe>');
      $body.append($iframe);
    }

    // 각 row마다 URL 셀 안의 <a>에 이벤트 바인딩
    $rows.each(function () {
      const $tr  = $(this);
      const $tds = $tr.find('td');

      // URL 셀
      const $urlCell = $tds.eq(urlIdx);
      if (!$urlCell.length) return;

      const $link = $urlCell.find('a');
      if (!$link.length) return;

      // .delete 안에 있는 링크는 제외
      if ($link.closest('.delete').length) return;

      $link.on('mouseover', function () {
        const href = $link.attr('href');

        if (!href) return;

        // iframe 보이게 + src 설정
        $iframe
          .attr('src', href)
          .css('display', 'block');

        // iframe 안의 .wrap 스타일 조정
        setTimeout(function () {
          const $wrap = $('#ifrm').contents().find('.wrap');
          $wrap.css({
            transform: 'scale(1)',
            'transform-origin': '0 0',
          });
        }, 200);
      }).on('mouseout', function () {
        $iframe.css('display', 'none');
      });
    });
    const $tables = $('.js-menu-table').not('.duide');
    const $brows = $tables.find('tbody tr');
    const $endPage = $('.btn.end');
    const $mdyPage = $('.btn.mdy');
    const total = $brows.length;      // 전체 개수
    const done  = $endPage.length - 1;    // 완료된 개수
    $('#total').text(total + '개');
    $('#ok-page').text(done + '개');
    $('#mdy').text($mdyPage.length - 1 + '개');

    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    $('#persent').text(percent + '%');
  });
});
