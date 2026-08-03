(function () {
  'use strict';

  const FAVORITES_KEY = 'aiAgentHub_favorites';
  const AVATAR_EMOJIS = ['🤖', '🦾', '🧠', '⚙️', '🔧', '📊', '🛰️', '💡', '🧩', '🔍'];
  const CATEGORY_COLORS = {
    '기술개발도출지원': '#3987e5',
    '이슈원인분석': '#199e70',
    'MRM 과제운영': '#9085e9',
    '제품개발 프로세스': '#e66767',
  };

  function avatarEmojiFor(id) {
    return AVATAR_EMOJIS[Math.abs(id) % AVATAR_EMOJIS.length];
  }

  function colorFor(category) {
    return CATEGORY_COLORS[category] || '#3987e5';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }

  function formatDate(str) {
    if (!str) return '';
    return str.replace('T', ' ').slice(0, 16);
  }

  function formatDateShort(str) {
    if (!str) return '';
    const [y, m, d] = str.slice(0, 10).split('-');
    return y.slice(2) + '.' + m + '.' + d;
  }

  function orgLine(item) {
    return [item.orgGroup, item.orgDept, item.orgTeam].filter(Boolean).join(' · ');
  }

  // 오늘 날짜(로컬 기준) 문자열 — "오늘의 추천" 시드로 사용
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 문자열 시드 기반 결정적 셔플(같은 날에는 같은 순서, 외부 라이브러리 없이 mulberry32 PRNG 사용)
  function seededShuffle(arr, seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
    let seed = h;
    function rand() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------------
  // 즐겨찾기 (localStorage, 로그인 없이 브라우저 로컬 저장)
  // ---------------------------------------------------------------------
  const favorites = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
      } catch (e) {
        return [];
      }
    },
    has(id) {
      return favorites.get().includes(id);
    },
    toggle(id) {
      const list = favorites.get();
      const idx = list.indexOf(id);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
      return list.includes(id);
    },
  };

  function updateFavoritesBadge() {
    const el = document.getElementById('statFavorites');
    if (el) el.textContent = formatNumber(favorites.get().length);
  }

  // ---------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------
  const api = {
    async request(url, opts) {
      const res = await fetch(url, opts);
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('서버 응답을 해석할 수 없습니다.');
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
      }
      return data;
    },
    getJSON(url) {
      return api.request(url);
    },
    postJSON(url, body) {
      return api.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    postForm(url, formData) {
      return api.request(url, { method: 'POST', body: formData });
    },

    stats: () => api.getJSON('api/stats.php'),
    visitPing: () => api.postJSON('api/visit_ping.php', {}),
    agentsList: (sort, category) =>
      api.getJSON('api/agents_list.php?sort=' + encodeURIComponent(sort) + '&category=' + encodeURIComponent(category)),
    agentDetail: (id) => api.getJSON('api/agent_detail.php?id=' + id),
    like: (agentId) => api.postJSON('api/like.php', { agentId }),
    agentUpload: (formData) => api.postForm('api/agent_upload.php', formData),
    noticesList: () => api.getJSON('api/notices_list.php'),
    noticesCreate: (body) => api.postJSON('api/notices_create.php', body),
    postsList: (page) => api.getJSON('api/posts_list.php?page=' + (page || 1) + '&pageSize=10'),
    postsCreate: (body) => api.postJSON('api/posts_create.php', body),
    feedbackCreate: (body) => api.postJSON('api/feedback_create.php', body),
    recommend: (body) => api.postJSON('api/recommend.php', body),
  };

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    sort: 'default',
    category: 'all',
    agents: [],
    searchQuery: '',
    favoritesOnly: false,
    postsPage: 1,
    uploadFile: null,
  };

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------
  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function handleError(err) {
    console.error(err);
    showToast(err.message || '오류가 발생했습니다.', 'error');
  }

  // ---------------------------------------------------------------------
  // 대시보드
  // ---------------------------------------------------------------------
  async function loadStats() {
    const data = await api.stats();
    document.getElementById('statAgentCount').textContent = formatNumber(data.agentCount);
    document.getElementById('statTeamCount').textContent = formatNumber(data.teamCount);
    document.getElementById('statCategoryCount').textContent = formatNumber(data.categoryCount);
    updateFavoritesBadge();
    renderCategoryBreakdown(data.categoryBreakdown);
  }

  // 데이터 최대값을 그대로 축 최대값으로 쓰면 막대가 전부 끝까지 차 보이므로,
  // 축 최대값은 "보기 좋은" 반올림 값(1/2/5/10 단위)으로 올림해 여유 공간을 둔다.
  function niceAxisMax(value) {
    if (value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * Math.pow(10, exponent);
  }

  function renderCategoryBreakdown(breakdown) {
    const container = document.getElementById('categoryBreakdown');
    const rawMax = Math.max(1, ...breakdown.map((b) => b.count));
    const axisMax = niceAxisMax(rawMax);
    container.innerHTML = breakdown
      .map(
        (b) => `
      <div class="cat-bar-col">
        <span class="cat-bar-col-value">${formatNumber(b.count)}</span>
        <div class="cat-bar-col-track"><div class="cat-bar-col-fill" style="height:${Math.max(3, (b.count / axisMax) * 100)}%;background:${colorFor(b.category)}"></div></div>
        <span class="cat-bar-col-label">${escapeHtml(b.category)}</span>
      </div>`
      )
      .join('');
  }

  // ---------------------------------------------------------------------
  // Agent 카드 / 그리드
  // ---------------------------------------------------------------------
  function createAgentCard(item) {
    const card = document.createElement('div');
    card.className = 'card id-card';
    card.tabIndex = 0;

    const isFav = favorites.has(item.id);
    const org = orgLine(item);
    const color = colorFor(item.category);
    const statusChip = item.isPlaceholder
      ? '<span class="status-chip pending"><i class="fa-solid fa-hourglass-half"></i> 준비중</span>'
      : '<span class="status-chip active"><i class="fa-solid fa-circle"></i> 사용 가능</span>';

    card.style.setProperty('--dept-color', color);
    card.innerHTML = `
      <div class="id-card-stripe" style="background:${color}"></div>
      <div class="card-thumb">
        <div class="icon-badge" style="border-color:${color};color:${color}">${avatarEmojiFor(item.id)}</div>
        <button type="button" class="fav-btn ${isFav ? 'active' : ''}" title="즐겨찾기">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
        </button>
      </div>
      <div class="card-body">
        <div class="card-top-row">
          <span class="card-category-tag" style="background:${color}22;color:${color}">${escapeHtml(item.category)}</span>
          ${statusChip}
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-role"><i class="fa-solid fa-id-badge"></i> ${escapeHtml(item.roleTitle || 'AI Agent')}</p>
        <p class="card-desc">${escapeHtml(item.description || '설명이 없습니다.')}</p>
        <div class="card-footer-row">
          ${org ? `<span class="card-org"><i class="fa-solid fa-sitemap"></i> ${escapeHtml(org)}</span>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const nowFav = favorites.toggle(item.id);
      const btn = e.currentTarget;
      btn.classList.toggle('active', nowFav);
      btn.querySelector('i').className = `fa-${nowFav ? 'solid' : 'regular'} fa-star`;
      updateFavoritesBadge();
      if (state.favoritesOnly) renderGrid();
    });

    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') card.click();
    });
    return card;
  }

  // ---------------------------------------------------------------------
  // 큐레이션 캐러셀 (오늘의 추천 / 신규 / Top 5)
  // ---------------------------------------------------------------------
  function renderCarouselRow(containerId, items, opts) {
    opts = opts || {};
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'carousel-card' + (opts.ranked ? ' ranked' : '');
      if (opts.ranked) {
        const rank = document.createElement('div');
        rank.className = 'rank-badge';
        rank.textContent = String(idx + 1);
        wrap.appendChild(rank);
      }
      wrap.appendChild(createAgentCard(item));
      container.appendChild(wrap);
    });
  }

  function toggleSection(id, visible) {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  async function loadCuratedSections() {
    const data = await api.agentsList('default', 'all');
    const all = data.items;

    const realAgents = all.filter((a) => !a.isPlaceholder);
    const todayPicks = seededShuffle(realAgents, todayKey()).slice(0, 4);
    renderCarouselRow('curatedTodayRow', todayPicks);
    toggleSection('curatedToday', todayPicks.length > 0);

    const newest = all.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    renderCarouselRow('curatedNewRow', newest);
    toggleSection('curatedNew', newest.length > 0);

    const top5 = all.slice().sort((a, b) => b.likeCount - a.likeCount).slice(0, 5);
    renderCarouselRow('curatedTop5Row', top5, { ranked: true });
    toggleSection('curatedTop5', top5.length > 0);
  }

  function getFilteredAgents() {
    let items = state.agents;
    if (state.favoritesOnly) {
      items = items.filter((a) => favorites.has(a.id));
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      items = items.filter((a) => {
        const haystack = [a.title, a.description, a.orgGroup, a.orgDept, a.orgTeam].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    return items;
  }

  function renderGrid() {
    const items = getFilteredAgents();
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = state.favoritesOnly
        ? '<i class="fa-regular fa-star"></i><p>즐겨찾기한 Agent가 없습니다.</p>'
        : '<i class="fa-solid fa-robot"></i><p>조건에 맞는 Agent가 없습니다.</p>';
      grid.appendChild(empty);
    } else {
      items.forEach((item) => grid.appendChild(createAgentCard(item)));
    }

    const hint = document.getElementById('searchHint');
    if (state.searchQuery) {
      hint.style.display = '';
      hint.textContent = `${items.length}개 결과`;
    } else {
      hint.style.display = 'none';
    }
  }

  async function loadAgents() {
    const data = await api.agentsList(state.sort, state.category);
    state.agents = data.items;
    renderGrid();
  }

  function bindFilterBar() {
    document.querySelector('#agents .filter-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#agents .filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.sort = btn.dataset.sort;
      loadAgents().catch(handleError);
    });

    document.getElementById('categoryFilterBar').addEventListener('click', (e) => {
      const btn = e.target.closest('.category-filter-btn');
      if (!btn) return;
      document.querySelectorAll('#categoryFilterBar .category-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.category;
      loadAgents().catch(handleError);
    });

    document.getElementById('favoritesToggle').addEventListener('click', (e) => {
      state.favoritesOnly = !state.favoritesOnly;
      e.currentTarget.classList.toggle('active', state.favoritesOnly);
      e.currentTarget.querySelector('i').className = `fa-${state.favoritesOnly ? 'solid' : 'regular'} fa-star`;
      renderGrid();
    });
  }

  function bindSearch() {
    let timer = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(timer);
      const value = e.target.value.trim();
      timer = setTimeout(() => {
        state.searchQuery = value;
        renderGrid();
      }, 150);
    });
  }

  // ---------------------------------------------------------------------
  // 모달 뷰어 (Agent 실행 + 좋아요/평점)
  // ---------------------------------------------------------------------
  function openModal(item) {
    const modal = document.getElementById('modal');
    const frame = document.getElementById('modalFrame');
    const titleEl = document.getElementById('modalTitle');
    const openNew = document.getElementById('modalOpenNew');
    const footer = document.getElementById('modalFooter');

    titleEl.querySelector('span:last-child').textContent = item.title;
    openNew.href = item.fileUrl;
    frame.src = 'about:blank';
    frame.src = item.fileUrl;
    footer.innerHTML = '<span class="meta">로딩 중…</span>';

    modal.classList.add('open');
    document.body.classList.add('modal-open');

    api
      .agentDetail(item.id)
      .then((detail) => renderModalFooter(footer, detail))
      .catch((err) => {
        footer.innerHTML = '<span class="meta">정보를 불러오지 못했습니다.</span>';
        handleError(err);
      });
  }

  function renderModalFooter(footer, detail) {
    const org = orgLine(detail);
    const color = colorFor(detail.category);
    footer.innerHTML = `
      <div class="modal-persona-row">
        <div class="icon-badge sm" style="border-color:${color};color:${color}">${avatarEmojiFor(detail.id)}</div>
        <div>
          <p class="modal-role"><i class="fa-solid fa-id-badge"></i> ${escapeHtml(detail.roleTitle || 'AI Agent')}</p>
        </div>
      </div>
      <button type="button" class="modal-like-btn ${detail.likedByMe ? 'liked' : ''}" id="modalLikeBtn">
        <i class="fa-solid fa-heart"></i> <span id="modalLikeCount">${formatNumber(detail.likeCount)}</span>
      </button>
      ${org ? `<span class="meta"><i class="fa-solid fa-sitemap"></i> ${escapeHtml(org)}</span>` : ''}
    `;

    const likeBtn = footer.querySelector('#modalLikeBtn');
    likeBtn.addEventListener('click', async () => {
      try {
        const res = await api.like(detail.id);
        likeBtn.classList.toggle('liked', res.liked);
        footer.querySelector('#modalLikeCount').textContent = formatNumber(res.likeCount);
        loadStats().catch(() => {});
        loadAgents().catch(() => {});
        loadCuratedSections().catch(() => {});
      } catch (err) {
        handleError(err);
      }
    });
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    const frame = document.getElementById('modalFrame');
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    frame.src = 'about:blank';
  }

  function bindModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeUploadModal();
        closeFeedbackModal();
        closePostModal();
        closeRecommendModal();
        closeNoticeModal();
        closeNoticeViewModal();
      }
    });
  }

  // ---------------------------------------------------------------------
  // 공지사항 (헤더 우측 미니 패널 — 목록형)
  // ---------------------------------------------------------------------
  let noticesCache = [];

  async function loadNotices() {
    const data = await api.noticesList();
    noticesCache = data.items;
    renderNotices(noticesCache);
  }

  function renderNotices(items) {
    const list = document.getElementById('noticeList');
    if (!items.length) {
      list.innerHTML = '<div class="hero-notice-empty">등록된 공지사항이 없습니다.</div>';
      return;
    }
    list.innerHTML = '';
    items.forEach((n, idx) => {
      const row = document.createElement('div');
      row.className = 'hero-notice-row';
      row.innerHTML = `
        <span class="hero-notice-row-num">${items.length - idx}</span>
        <span class="hero-notice-row-title">${escapeHtml(n.title)}</span>
        <span class="hero-notice-row-date">${formatDateShort(n.createdAt)}</span>
      `;
      row.addEventListener('click', () => openNoticeViewModal(n));
      list.appendChild(row);
    });
  }

  function openNoticeViewModal(notice) {
    document.getElementById('noticeViewTitle').textContent = notice.title;
    document.getElementById('noticeViewMeta').textContent = `${notice.author} · ${formatDate(notice.createdAt)}`;
    document.getElementById('noticeViewContent').textContent = notice.content;
    document.getElementById('noticeViewModal').classList.add('open');
  }
  function closeNoticeViewModal() {
    document.getElementById('noticeViewModal').classList.remove('open');
  }

  function openNoticeModal() {
    document.getElementById('noticeModal').classList.add('open');
  }
  function closeNoticeModal() {
    document.getElementById('noticeModal').classList.remove('open');
  }

  function bindNoticeForm() {
    document.getElementById('openNoticeModal').addEventListener('click', openNoticeModal);
    document.getElementById('closeNoticeModal').addEventListener('click', closeNoticeModal);
    document.getElementById('noticeModal').addEventListener('click', (e) => {
      if (e.target.id === 'noticeModal') closeNoticeModal();
    });

    document.getElementById('closeNoticeViewModal').addEventListener('click', closeNoticeViewModal);
    document.getElementById('noticeViewModal').addEventListener('click', (e) => {
      if (e.target.id === 'noticeViewModal') closeNoticeViewModal();
    });

    document.getElementById('noticeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('noticeTitle').value.trim();
      const content = document.getElementById('noticeContent').value.trim();
      const author = document.getElementById('noticeAuthor').value.trim();
      if (!title || !content) return;
      const submitBtn = document.getElementById('noticeSubmitBtn');
      submitBtn.disabled = true;
      try {
        await api.noticesCreate({ title, content, author });
        document.getElementById('noticeForm').reset();
        showToast('공지사항이 등록되었습니다.', 'success');
        closeNoticeModal();
        loadNotices().catch(handleError);
      } catch (err) {
        handleError(err);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // 자유게시판
  // ---------------------------------------------------------------------
  async function loadPosts(page) {
    state.postsPage = page;
    const data = await api.postsList(page);
    renderPosts(data);
  }

  function renderPosts(data) {
    const list = document.getElementById('postList');
    if (!data.items.length) {
      list.innerHTML = '<div class="empty"><i class="fa-solid fa-comments"></i><p>등록된 글이 없습니다.</p></div>';
    } else {
      list.innerHTML = '';
      data.items.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'board-item clickable';
        el.innerHTML = `
          <div class="board-item-head">
            <span class="board-item-title">${escapeHtml(p.title)}</span>
            <span class="board-item-date">${formatDate(p.createdAt)}</span>
          </div>
          <p class="board-item-content">${escapeHtml(p.content)}</p>
          <span class="board-item-author">${escapeHtml(p.author)}</span>
        `;
        el.addEventListener('click', () => openPostModal(p));
        list.appendChild(el);
      });
    }

    const pagination = document.getElementById('postPagination');
    if (data.totalPages > 1) {
      pagination.style.display = '';
      document.getElementById('pageInfo').textContent = `${data.page} / ${data.totalPages}`;
      document.getElementById('prevPageBtn').disabled = data.page <= 1;
      document.getElementById('nextPageBtn').disabled = data.page >= data.totalPages;
    } else {
      pagination.style.display = 'none';
    }
  }

  function openPostModal(post) {
    document.getElementById('postModalTitle').textContent = post.title;
    document.getElementById('postModalMeta').textContent = `${post.author} · ${formatDate(post.createdAt)}`;
    document.getElementById('postModalContent').textContent = post.content;
    document.getElementById('postModal').classList.add('open');
  }
  function closePostModal() {
    document.getElementById('postModal').classList.remove('open');
  }

  function bindPosts() {
    document.getElementById('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('postTitle').value.trim();
      const content = document.getElementById('postContent').value.trim();
      const author = document.getElementById('postAuthor').value.trim();
      if (!title || !content) return;
      try {
        await api.postsCreate({ title, content, author });
        document.getElementById('postForm').reset();
        showToast('글이 등록되었습니다.', 'success');
        loadPosts(1).catch(handleError);
      } catch (err) {
        handleError(err);
      }
    });

    document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (state.postsPage > 1) loadPosts(state.postsPage - 1).catch(handleError);
    });
    document.getElementById('nextPageBtn').addEventListener('click', () => {
      loadPosts(state.postsPage + 1).catch(handleError);
    });

    document.getElementById('closePostModal').addEventListener('click', closePostModal);
    document.getElementById('postModal').addEventListener('click', (e) => {
      if (e.target.id === 'postModal') closePostModal();
    });
  }

  // ---------------------------------------------------------------------
  // 업로드 모달 (Agent 등록)
  // ---------------------------------------------------------------------
  function openUploadModal() {
    document.getElementById('uploadModal').classList.add('open');
  }
  function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('open');
  }

  function setUploadFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['html', 'htm'].includes(ext)) {
      showToast('HTML 파일(.html, .htm)만 업로드할 수 있습니다.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('파일은 5MB 이하만 업로드할 수 있습니다.', 'error');
      return;
    }
    state.uploadFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSelected').style.display = '';
    document.getElementById('dropZone').style.display = 'none';
  }

  function resetUploadForm() {
    state.uploadFile = null;
    document.getElementById('uploadForm').reset();
    document.getElementById('fileSelected').style.display = 'none';
    document.getElementById('dropZone').style.display = '';
  }

  function bindUploadModal() {
    document.getElementById('openUploadModal').addEventListener('click', openUploadModal);
    document.getElementById('closeUploadModal').addEventListener('click', closeUploadModal);
    document.getElementById('uploadModal').addEventListener('click', (e) => {
      if (e.target.id === 'uploadModal') closeUploadModal();
    });

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => setUploadFile(fileInput.files[0]));

    ['dragenter', 'dragover'].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
      })
    );
    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
    });

    document.getElementById('removeFile').addEventListener('click', resetUploadForm);

    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.uploadFile) {
        showToast('업로드할 파일을 선택해주세요.', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('title', document.getElementById('uploadTitle').value.trim());
      formData.append('category', document.getElementById('uploadCategory').value);
      formData.append('roleTitle', document.getElementById('uploadRoleTitle').value.trim());
      formData.append('personaIntro', document.getElementById('uploadPersonaIntro').value.trim());
      formData.append('description', document.getElementById('uploadDescription').value.trim());
      formData.append('orgGroup', document.getElementById('uploadOrgGroup').value.trim());
      formData.append('orgDept', document.getElementById('uploadOrgDept').value.trim());
      formData.append('orgTeam', document.getElementById('uploadOrgTeam').value.trim());
      formData.append('uploader', document.getElementById('uploadUploader').value.trim());
      formData.append('file', state.uploadFile);

      const submitBtn = document.getElementById('uploadSubmitBtn');
      submitBtn.disabled = true;
      try {
        await api.agentUpload(formData);
        showToast('Agent가 등록되었습니다.', 'success');
        resetUploadForm();
        closeUploadModal();
        loadAgents().catch(handleError);
        loadStats().catch(() => {});
        loadCuratedSections().catch(() => {});
      } catch (err) {
        handleError(err);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // 피드백 모달
  // ---------------------------------------------------------------------
  function openFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('open');
  }
  function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('open');
  }

  function bindFeedbackModal() {
    document.getElementById('openFeedbackModal').addEventListener('click', openFeedbackModal);
    document.getElementById('closeFeedbackModal').addEventListener('click', closeFeedbackModal);
    document.getElementById('feedbackModal').addEventListener('click', (e) => {
      if (e.target.id === 'feedbackModal') closeFeedbackModal();
    });

    document.getElementById('fbCategoryGroup').addEventListener('click', (e) => {
      const btn = e.target.closest('.fb-cat-btn');
      if (!btn) return;
      document.querySelectorAll('#fbCategoryGroup .fb-cat-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });

    document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('fbName').value.trim();
      const email = document.getElementById('fbEmail').value.trim();
      const title = document.getElementById('fbTitle').value.trim();
      const content = document.getElementById('fbContent').value.trim();
      const category = document.querySelector('#fbCategoryGroup .fb-cat-btn.selected').dataset.value;

      const submitBtn = document.getElementById('fbSubmitBtn');
      submitBtn.disabled = true;
      try {
        await api.feedbackCreate({ name, email, title, category, content });
        document.getElementById('feedbackForm').style.display = 'none';
        document.getElementById('fbSuccessMsg').style.display = '';
        setTimeout(() => {
          closeFeedbackModal();
          document.getElementById('feedbackForm').reset();
          document.getElementById('feedbackForm').style.display = '';
          document.getElementById('fbSuccessMsg').style.display = 'none';
          document.querySelectorAll('#fbCategoryGroup .fb-cat-btn').forEach((b) => b.classList.remove('selected'));
          document.querySelector('#fbCategoryGroup .fb-cat-btn[data-value="기타"]').classList.add('selected');
        }, 2000);
      } catch (err) {
        handleError(err);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // AI 매니저 추천
  // ---------------------------------------------------------------------
  function openRecommendModal() {
    document.getElementById('recommendModal').classList.add('open');
  }
  function closeRecommendModal() {
    document.getElementById('recommendModal').classList.remove('open');
  }

  function createRecommendResultItem(item) {
    const el = document.createElement('div');
    el.className = 'recommend-result-item';
    const color = colorFor(item.category);
    const reason = item.matchedKeywords.length
      ? `<span class="recommend-match-reason"><i class="fa-solid fa-check"></i> ${item.matchedKeywords.map(escapeHtml).join(', ')} 일치</span>`
      : `<span class="recommend-match-reason muted">정확히 일치하는 키워드는 없지만 인기 있는 팀원이에요</span>`;
    el.innerHTML = `
      <div class="icon-badge sm" style="border-color:${color};color:${color}">${avatarEmojiFor(item.id)}</div>
      <div class="recommend-result-body">
        <span class="card-category-tag" style="background:${color}22;color:${color}">${escapeHtml(item.category)}</span>
        <h4>${escapeHtml(item.title)}</h4>
        <p class="card-role"><i class="fa-solid fa-id-badge"></i> ${escapeHtml(item.roleTitle || 'AI Agent')}</p>
        <p class="recommend-result-desc">${escapeHtml(item.description || '설명이 없습니다.')}</p>
        ${reason}
      </div>
    `;
    el.addEventListener('click', () => {
      closeRecommendModal();
      openModal(item);
    });
    return el;
  }

  function bindRecommendModal() {
    document.getElementById('openRecommendModal').addEventListener('click', openRecommendModal);
    document.getElementById('closeRecommendModal').addEventListener('click', closeRecommendModal);
    document.getElementById('recommendModal').addEventListener('click', (e) => {
      if (e.target.id === 'recommendModal') closeRecommendModal();
    });

    document.getElementById('recommendForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('recName').value.trim();
      const orgTeam = document.getElementById('recOrgTeam').value.trim();
      const needText = document.getElementById('recNeedText').value.trim();
      if (!needText) return;

      const submitBtn = document.getElementById('recSubmitBtn');
      submitBtn.disabled = true;
      try {
        const data = await api.recommend({ name, orgTeam, needText });
        const resultsBox = document.getElementById('recommendResults');
        const list = document.getElementById('recommendResultList');
        const title = document.getElementById('recommendResultsTitle');
        title.textContent = data.noMatch
          ? '꼭 맞는 팀원을 찾지 못해, 인기 있는 팀원을 대신 추천드려요'
          : `이런 디지털 팀원은 어떠세요?`;
        list.innerHTML = '';
        data.results.forEach((item) => list.appendChild(createRecommendResultItem(item)));
        resultsBox.style.display = '';
      } catch (err) {
        handleError(err);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // 좌측 사이드 내비게이션 (스크롤 위치에 따라 active 표시)
  // ---------------------------------------------------------------------
  function bindSideNav() {
    const links = Array.from(document.querySelectorAll('.top-nav-link'));
    if (!links.length) return;
    const targets = links
      .map((link) => document.getElementById(link.dataset.target))
      .filter(Boolean);
    if (!targets.length) return;

    const setActive = (id) => {
      links.forEach((link) => link.classList.toggle('active', link.dataset.target === id));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-150px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    targets.forEach((el) => observer.observe(el));
  }

  function init() {
    bindFilterBar();
    bindSearch();
    bindModal();
    bindNoticeForm();
    bindPosts();
    bindUploadModal();
    bindFeedbackModal();
    bindRecommendModal();
    bindSideNav();
    updateFavoritesBadge();

    loadStats().catch(handleError);
    api.visitPing().then(loadStats).catch(() => {});
    loadAgents().catch(handleError);
    loadCuratedSections().catch(handleError);
    loadNotices().catch(handleError);
    loadPosts(1).catch(handleError);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
