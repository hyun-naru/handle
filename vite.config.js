// ================================
// Vite 프로젝트 설정 파일
// - 다중 HTML 페이지 (MPA) 자동 인식
// - Handlebars 템플릿 처리
// - SCSS + PostCSS(pxtorem, autoprefixer)
// - CSS 실시간 반영 대응
// ================================

import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import fullReload from 'vite-plugin-full-reload';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import autoprefixer from 'autoprefixer';
import pxtorem from 'postcss-pxtorem';

// ESM 환경에서는 __dirname 사용 불가 → 직접 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const partialPath = 'src/partials';
// ✅ 엔트리 수집 함수
// - 재귀적으로 디렉토리를 순회하며 .html / .js / .css 파일을 찾아 엔트리로 등록
// - Rollup/Vite의 input으로 활용 가능
const getEntries = dir => {
  const htmlEntries = {}; // 결과 저장 객체
  // 🔐 특정 경로 필터링 조건 (불필요한 경로 스킵)
  // 예: partialPath나 helperPath 포함한 경로는 제외
  // 현재는 partialPath 변수가 주석 처리된 상태
  // -> 필터링 조건이 완전하지 않음 (조건 최종 확인 필요)
  if (dir.length === dir.replace(partialPath, '').length && dir.length) {
    // 현재 디렉토리의 모든 항목 순회 (파일 또는 폴더)
    fs.readdirSync(dir).forEach(item => {
      const itemPath = path.join(dir, item); // 전체 경로 생성
  
      // 📄 파일인 경우
      if (fs.statSync(itemPath).isFile()) {
        // 확장자가 .html, .js, .css인 경우만 처리
        const ext = path.extname(item);
        if (['.html', '.js', '.css'].includes(ext)) {
          // 엔트리 객체에 추가 (키: 전체 경로, 값: resolve된 경로)
          htmlEntries[itemPath] = path.resolve(__dirname, itemPath);
        }
      } 
      // 📁 디렉토리인 경우 → 재귀 호출로 하위 폴더 탐색
      else {
        Object.assign(htmlEntries, getEntries(itemPath)); // 결과 병합
      }
    });
  }

  return htmlEntries; // 모든 유효한 엔트리 반환
};

const getContexts = dir => {
  const contexts = {};

  fs.readdirSync(dir).forEach(item => {
    const itemPath = path.join(dir, item);

    if(fs.statSync(itemPath).isFile()) {
      if(path.extname(item) == '.json') {
        contexts[itemPath.replace('src','').replace('config.json', 'html')] = JSON.parse(fs.readFileSync(itemPath));
      }
    } else {
      Object.assign(contexts, getContexts(itemPath));
    }
  });

  return contexts;
}

const pageData = getContexts('src');

const replaceMap = {
  '/css/reset.css': '../../css/reset.css',
  '/css/common.css': '../../css/common.css',
  '/css/guide.css': '../../css/guide.css',
};

export default defineConfig({
  // 중요: 빌드된 파일들이 상대 경로(./)를 참조하도록 설정
  base: '/handle/',
  root: 'src',                    // 개발 소스 루트 경로
  publicDir: '../public',         // 정적 파일 경로 (파빌릭 에셋들 위치)
  build: {
    outDir: '../dist',            // 빌드 출력 경로 (프로젝트 루트 기준)// 상대 경로 대신 절대 경로가 Actions에서 안전
    emptyOutDir: true,            // 빌드 전 dist 비우기
    assetsDir: 'assets',          // 에셋(JS/CSS 등) 루트 위치 지정

    minify: false,                // 압축 비활성화 (개발용),
    overwrite: true,             // 기존 빌드 파일 덮어쓰기 허용
    terserOptions: {
      output: {
        comments: true           // 주석 보존
      }
    },

    rollupOptions: {
      input: getEntries('src'),  // 다중 페이지용 HTML 엔트리 자동 등록
      output: {
        // 📁 CSS 파일 경로 커스터마이징
        assetFileNames: (entry) => {
          if (path.extname(entry.name) === '.css') {
            return entry.name.replace('src/', '');
          }
          return entry.name;
        },
        // 📁 JS 파일 경로 커스터마이징
        entryFileNames: (entry) => {
          if (path.extname(entry.name) === '.js') {
            return path.relative('src', entry.name);
          }
          return entry.name;
        }
      }
    }
  },

  // ✅ Handlebars partials 사용
  plugins: [

    handlebars({
      partialDirectory: path.resolve(__dirname, 'src/partials'),
      context(pagePath) {
        return pageData[pagePath];
      },
    }),
    // ✅ CSS, SCSS, HTML 파일 변경 시 전체 페이지 리로드
    fullReload([
      'src/**/*.html',
      'src/**/*.scss',
      'src/**/*.js', // 필요시 JS도 포함
    ]),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        for (const [original, replacement] of Object.entries(replaceMap)) {
          const regex = new RegExp(`(?:crossorigin\\s*)?href="${original}"`, 'g');
          html = html.replace(regex, `href="${replacement}"`);
        }
        return html;
      }
    }
  ],

  // ✅ 개발 서버 설정
  server: {
    open: true,                 // 브라우저 자동 오픈
    watch: {
      usePolling: true,        // 파일 변경 감지 방식 (network-mounted 시스템 대응)
      interval: 100,            // 폴링 간격 (ms)
    }
  },

  // ✅ CSS 관련 설정 (PostCSS + SCSS Preprocessor)
  css: {
    postcss: {
      plugins: [
        autoprefixer(),        // CSS 브라우저 접두사 자동 추가
        pxtorem({
          rootValue: 16,       // 1rem = 16px
          propList: ['*'],     // 모든 속성에 적용
          selectorBlackList: []
        })
      ]
    },
    preprocessorOptions: {
      scss: {
        // SCSS 전역 공통 import 설정 (@use 사용 시 자동 주입됨)
        additionalData: `
          @use "@/css/core/variables" as *;
          @use "@/css/core/mixins" as *;
          @use "@/css/core/functions" as *;
        `,
      }
    }
  },

  // ✅ 경로 alias 설정 (ex: @ → src)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
