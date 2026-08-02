(() => {
  'use strict';

  const SUPABASE_URL = 'https://awqjhdihhwfijceurwya.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_atCYSxQQ39TktHIuvAHPBg_YPKK5FcV';
  const MEMOS_KEY = 'ideastock_memos';
  const MIGRATED_KEY = 'ideastock_migrated';
  const API_KEY_STORAGE = 'ideastock_apikey';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-haiku-4-5-20251001';
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const elements = {
    loginScreen: document.getElementById('login-screen'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginButton: document.getElementById('login-button'),
    loginError: document.getElementById('login-error'),
    appHeader: document.getElementById('app-header'),
    appMain: document.getElementById('app-main'),
    appNav: document.getElementById('app-nav'),
    offlineBanner: document.getElementById('offline-banner'),
    memoInput: document.getElementById('memo-input'),
    saveButton: document.getElementById('save-button'),
    micButton: document.getElementById('mic-button'),
    recentMemos: document.getElementById('recent-memos'),
    searchInput: document.getElementById('search-input'),
    categoryChips: document.getElementById('category-chips'),
    memoList: document.getElementById('memo-list'),
    apiKeyInput: document.getElementById('api-key-input'),
    connectionTest: document.getElementById('connection-test'),
    connectionStatus: document.getElementById('connection-status'),
    backupButton: document.getElementById('backup-button'),
    memoCount: document.getElementById('memo-count'),
    accountEmail: document.getElementById('account-email'),
    logoutButton: document.getElementById('logout-button'),
    syncStatus: document.getElementById('sync-status'),
    migrationDialog: document.getElementById('migration-dialog'),
    migrationCount: document.getElementById('migration-count'),
    migrationButton: document.getElementById('migration-button'),
    migrationLater: document.getElementById('migration-later'),
    migrationError: document.getElementById('migration-error'),
    toast: document.getElementById('toast')
  };

  const state = {
    memos: [],
    session: null,
    activeUserId: null,
    lastSyncAt: null,
    loadingMemos: false,
    offline: !navigator.onLine
  };

  let selectedCategory = 'すべて';
  let recognition = null;
  let isRecording = false;
  let speechPrefix = '';
  let toastTimer = null;
  let swipeState = null;

  function readLegacyMemos() {
    try {
      const stored = JSON.parse(localStorage.getItem(MEMOS_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter((memo) => memo && typeof memo.text === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function rowToMemo(row) {
    return {
      id: row.id,
      text: row.text || '',
      title: row.title || '',
      category: row.category || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      status: row.status || 'unsorted',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function memoToRow(memo) {
    return {
      id: memo.id,
      text: memo.text || '',
      title: memo.title || '',
      category: memo.category || '',
      tags: Array.isArray(memo.tags) ? memo.tags : [],
      status: memo.status || 'unsorted',
      created_at: memo.createdAt,
      updated_at: memo.updatedAt || memo.createdAt
    };
  }

  function isNetworkError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return !navigator.onLine || message.includes('failed to fetch') || message.includes('network') || message.includes('load failed');
  }

  function setOffline(offline) {
    state.offline = offline;
    elements.offlineBanner.hidden = !offline;
  }

  function handleSupabaseError(error) {
    if (isNetworkError(error)) setOffline(true);
  }

  function markSynced() {
    state.lastSyncAt = new Date().toISOString();
    if (navigator.onLine) setOffline(false);
    renderSyncStatus();
  }

  function sortNewest(memos) {
    return [...memos].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function makeId() {
    return crypto.randomUUID();
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const elapsed = now.getTime() - date.getTime();
    if (elapsed >= 0 && elapsed < 60 * 1000) return 'たった今';
    if (elapsed >= 0 && elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 1000))}分前`;
    if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 60 * 1000))}時間前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderSyncStatus() {
    const label = elements.syncStatus.querySelector('span:last-child');
    label.textContent = state.lastSyncAt ? `同期済み（${formatDate(state.lastSyncAt)}）` : '同期待ち';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function memoCard(memo) {
    const tags = Array.isArray(memo.tags) ? memo.tags.filter(Boolean) : [];
    const title = memo.status === 'done' && memo.title
      ? `<div class="title">${escapeHtml(memo.title)} <span class="ai">✦AI</span></div>`
      : '';
    const tagMarkup = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    const unsorted = memo.status === 'unsorted' ? '<span class="status-badge">未整理</span>' : '';
    const analyzing = memo.status === 'analyzing' ? '<div class="analyzing"><span class="dot"></span> AIが整理中…</div>' : '';
    const retry = memo.status === 'unsorted' ? `<button class="retry-btn" type="button" data-retry-id="${escapeHtml(memo.id)}">再整理</button>` : '';
    return `<div class="card-wrap" data-wrap-id="${escapeHtml(memo.id)}">
      <button class="delete-btn" type="button" data-delete-id="${escapeHtml(memo.id)}" aria-label="削除">🗑</button>
      <article class="card" data-memo-id="${escapeHtml(memo.id)}">
      ${title}
      <div class="body">${escapeHtml(memo.text)}</div>
      <button class="copy-btn" type="button" data-copy-id="${escapeHtml(memo.id)}" title="コピー" aria-label="メモをコピー">📋</button>
      <div class="meta">${tagMarkup}${unsorted}<span class="date">${formatDate(memo.createdAt)}</span></div>
      ${analyzing}${retry}
      </article>
    </div>`;
  }

  function render() {
    const memos = sortNewest(state.memos);
    const categories = [...new Set(memos.map((memo) => memo.category).filter(Boolean))];
    if (selectedCategory !== 'すべて' && !categories.includes(selectedCategory)) selectedCategory = 'すべて';

    elements.recentMemos.innerHTML = state.loadingMemos
      ? '<p class="empty">読み込み中…</p>'
      : memos.slice(0, 5).map(memoCard).join('') || '<p class="empty">まだメモはありません</p>';
    elements.categoryChips.innerHTML = ['すべて', ...categories].map((category) => (
      `<button class="chip ${category === selectedCategory ? 'on' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    )).join('');

    const query = elements.searchInput.value.trim().toLocaleLowerCase('ja-JP');
    const visibleMemos = memos.filter((memo) => {
      const searchable = [memo.text, memo.title, ...(Array.isArray(memo.tags) ? memo.tags : [])].join(' ').toLocaleLowerCase('ja-JP');
      return (selectedCategory === 'すべて' || memo.category === selectedCategory) && (!query || searchable.includes(query));
    });
    elements.memoList.innerHTML = state.loadingMemos
      ? '<p class="empty">読み込み中…</p>'
      : visibleMemos.map(memoCard).join('') || '<p class="empty">該当するメモはありません</p>';
    elements.memoCount.textContent = `メモはクラウドに保存され、ログインした全ての端末で共有されます。現在 ${memos.length}件。`;
    renderSyncStatus();
  }

  function showToast(message = '📋 クリップボードにコピーしました') {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 1500);
  }

  async function copyMemo(id, button) {
    const memo = state.memos.find((item) => item.id === id);
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(memo.text);
      button.textContent = '✓';
      showToast();
      setTimeout(() => { button.textContent = '📋'; }, 1500);
    } catch (_) {
      showToast('コピーできませんでした');
    }
  }

  async function deleteMemo(id) {
    try {
      const { error } = await db.from('memos').delete().eq('id', id);
      if (error) throw error;
      state.memos = state.memos.filter((memo) => memo.id !== id);
      markSynced();
      render();
      showToast('🗑 メモを削除しました');
    } catch (error) {
      handleSupabaseError(error);
      showToast(`削除できませんでした: ${error.message}`);
    }
  }

  function closeOpenCards(except = null) {
    document.querySelectorAll('.card-wrap.open').forEach((wrap) => {
      if (wrap !== except) wrap.classList.remove('open');
    });
  }

  function apiKey() {
    return localStorage.getItem(API_KEY_STORAGE)?.trim() || '';
  }

  async function callClaude(userPrompt, maxTokens = 300) {
    const key = apiKey();
    if (!key) throw new Error('APIキーが設定されていません');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    const text = data.content?.find((part) => part.type === 'text')?.text;
    if (!text) throw new Error('Claudeから応答を取得できませんでした');
    return text;
  }

  function parseAiResult(responseText) {
    const jsonText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.category !== 'string' || !Array.isArray(parsed.tags)) {
      throw new Error('AIの応答形式が不正です');
    }
    return {
      title: parsed.title.trim().slice(0, 15) || '無題のメモ',
      category: parsed.category.trim().slice(0, 30) || '未分類',
      tags: parsed.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 3)
    };
  }

  async function updateMemoOrganization(memo) {
    const { error } = await db.from('memos').update({
      title: memo.title,
      category: memo.category,
      tags: memo.tags,
      status: memo.status,
      updated_at: memo.updatedAt
    }).eq('id', memo.id);
    if (error) throw error;
    markSynced();
  }

  async function organizeMemo(id) {
    const memo = state.memos.find((item) => item.id === id);
    if (!memo) return;

    memo.status = 'analyzing';
    render();

    let organized;
    try {
      const categories = [...new Set(state.memos.map((item) => item.category).filter(Boolean))];
      const result = await callClaude(`次のアイデアメモを整理してください。既存カテゴリ: ${categories.length ? categories.join('、') : 'なし'}。\n\n本文: ${memo.text}\n\n日本語で、title（15字以内）、category（既存カテゴリに合うものがあれば必ず再利用。なければ新設）、tags（1〜3個）のJSONオブジェクトだけを返してください。説明やMarkdownは不要です。`);
      organized = parseAiResult(result);
    } catch (_) {
      const latestMemo = state.memos.find((item) => item.id === id);
      if (latestMemo) {
        latestMemo.status = 'unsorted';
        latestMemo.updatedAt = new Date().toISOString();
        try {
          await updateMemoOrganization(latestMemo);
        } catch (error) {
          handleSupabaseError(error);
        }
      }
      render();
      return;
    }

    const latestMemo = state.memos.find((item) => item.id === id);
    if (!latestMemo) return;
    Object.assign(latestMemo, organized, { status: 'done', updatedAt: new Date().toISOString() });
    try {
      await updateMemoOrganization(latestMemo);
    } catch (error) {
      handleSupabaseError(error);
      latestMemo.status = 'unsorted';
      latestMemo.updatedAt = new Date().toISOString();
      try {
        await updateMemoOrganization(latestMemo);
      } catch (statusError) {
        handleSupabaseError(statusError);
      }
    }
    render();
  }

  async function saveMemo() {
    const text = elements.memoInput.value.trim();
    if (!text) {
      elements.memoInput.focus();
      return;
    }
    const now = new Date().toISOString();
    const memo = { id: makeId(), text, createdAt: now, updatedAt: now, title: '', category: '', tags: [], status: 'analyzing' };
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = '保存中…';
    let saved = false;
    try {
      const { error } = await db.from('memos').insert(memoToRow(memo));
      if (error) throw error;
      state.memos.unshift(memo);
      elements.memoInput.value = '';
      markSynced();
      render();
      saved = true;
    } catch (error) {
      handleSupabaseError(error);
      showToast(`保存できませんでした: ${error.message}`);
    } finally {
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = '保存する';
    }
    if (saved) await organizeMemo(memo.id);
  }

  function setRecording(recording) {
    isRecording = recording;
    elements.micButton.classList.toggle('rec', recording);
    elements.micButton.textContent = recording ? '⏹' : '🎤';
    elements.micButton.setAttribute('aria-label', recording ? '音声入力を停止' : '音声入力');
  }

  function toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.alert('この端末ではキーボードのマイク（音声入力）をご利用ください');
      return;
    }
    if (isRecording) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;
    speechPrefix = elements.memoInput.value ? `${elements.memoInput.value}\n` : '';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      elements.memoInput.value = speechPrefix + transcript;
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    try {
      recognition.start();
      setRecording(true);
    } catch (_) {
      setRecording(false);
    }
  }

  async function testConnection() {
    elements.connectionStatus.className = 'connection-status';
    if (!apiKey()) {
      elements.connectionStatus.textContent = '✗ APIキーを入力してください';
      elements.connectionStatus.classList.add('error');
      return;
    }
    elements.connectionTest.disabled = true;
    elements.connectionTest.textContent = '確認中…';
    try {
      await callClaude('接続テストです。「OK」とだけ返してください。', 8);
      elements.connectionStatus.textContent = '✓ 接続OK';
      elements.connectionStatus.classList.add('ok');
    } catch (error) {
      elements.connectionStatus.textContent = `✗ ${error.message}`;
      elements.connectionStatus.classList.add('error');
    } finally {
      elements.connectionTest.disabled = false;
      elements.connectionTest.textContent = '接続テスト';
    }
  }

  function downloadBackup() {
    const data = JSON.stringify(sortNewest(state.memos), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    anchor.href = url;
    anchor.download = `ideastock_backup_${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function loadMemos() {
    const userId = state.activeUserId;
    state.loadingMemos = true;
    render();
    try {
      const { data, error } = await db.from('memos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (state.activeUserId !== userId) return false;
      state.memos = (data || []).map(rowToMemo);
      markSynced();
      return true;
    } catch (error) {
      handleSupabaseError(error);
      showToast(`メモを読み込めませんでした: ${error.message}`);
      return false;
    } finally {
      if (state.activeUserId === userId) {
        state.loadingMemos = false;
        render();
      }
    }
  }

  function closeMigrationDialog() {
    elements.migrationDialog.hidden = true;
    elements.migrationError.textContent = '';
  }

  function showMigrationIfNeeded() {
    const legacyMemos = readLegacyMemos();
    if (legacyMemos.length === 0 || localStorage.getItem(MIGRATED_KEY) === 'true') return;
    elements.migrationCount.textContent = `${legacyMemos.length}件`;
    elements.migrationError.textContent = '';
    elements.migrationDialog.hidden = false;
  }

  async function migrateMemos() {
    const legacyMemos = readLegacyMemos();
    if (legacyMemos.length === 0) {
      closeMigrationDialog();
      return;
    }
    elements.migrationButton.disabled = true;
    elements.migrationLater.disabled = true;
    elements.migrationButton.textContent = '移行中…';
    elements.migrationError.textContent = '';
    try {
      const { error } = await db.from('memos').insert(legacyMemos.map(memoToRow));
      if (error) throw error;
      localStorage.setItem(MIGRATED_KEY, 'true');
      markSynced();
      closeMigrationDialog();
      await loadMemos();
      showToast('クラウドに移しました');
    } catch (error) {
      handleSupabaseError(error);
      elements.migrationError.textContent = `移行できませんでした: ${error.message}`;
    } finally {
      elements.migrationButton.disabled = false;
      elements.migrationLater.disabled = false;
      elements.migrationButton.textContent = 'クラウドに移す';
    }
  }

  function showLoggedOut() {
    state.session = null;
    state.activeUserId = null;
    state.memos = [];
    state.lastSyncAt = null;
    state.loadingMemos = false;
    closeMigrationDialog();
    elements.loginScreen.hidden = false;
    elements.appHeader.hidden = true;
    elements.appMain.hidden = true;
    elements.appNav.hidden = true;
    elements.accountEmail.textContent = '';
    render();
  }

  async function showLoggedIn(session) {
    state.session = session;
    elements.loginScreen.hidden = true;
    elements.appHeader.hidden = false;
    elements.appMain.hidden = false;
    elements.appNav.hidden = false;
    elements.accountEmail.textContent = session.user.email || '';
    setOffline(state.offline || !navigator.onLine);

    if (state.activeUserId === session.user.id) return;
    switchScreen('write');
    state.activeUserId = session.user.id;
    state.memos = [];
    state.lastSyncAt = null;
    const loaded = await loadMemos();
    if (loaded && state.activeUserId === session.user.id) showMigrationIfNeeded();
  }

  async function submitLogin(event) {
    event.preventDefault();
    elements.loginError.textContent = '';
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = 'ログイン中…';
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: elements.loginEmail.value.trim(),
        password: elements.loginPassword.value
      });
      if (error) throw error;
      if (data.session) await showLoggedIn(data.session);
      elements.loginPassword.value = '';
    } catch (error) {
      handleSupabaseError(error);
      elements.loginError.textContent = error.message === 'Invalid login credentials'
        ? 'メールアドレスかパスワードが違います'
        : error.message;
    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = 'ログイン';
    }
  }

  async function logout() {
    elements.logoutButton.disabled = true;
    elements.logoutButton.textContent = 'ログアウト中…';
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      showLoggedOut();
    } catch (error) {
      handleSupabaseError(error);
      showToast(`ログアウトできませんでした: ${error.message}`);
    } finally {
      elements.logoutButton.disabled = false;
      elements.logoutButton.textContent = 'ログアウト';
    }
  }

  function switchScreen(name) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `${name}-screen`));
    document.querySelectorAll('nav button').forEach((button) => button.classList.toggle('on', button.dataset.screen === name));
    if (name === 'list' || name === 'settings') render();
  }

  elements.appNav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-screen]');
    if (button) switchScreen(button.dataset.screen);
  });

  document.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('.card');
    if (!card || event.target.closest('button')) return;
    const wrap = card.closest('.card-wrap');
    if (!wrap) return;
    swipeState = {
      wrap,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      direction: null,
      wasOpen: wrap.classList.contains('open')
    };
  });

  document.addEventListener('pointermove', (event) => {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;
    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;

    if (!swipeState.direction) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      swipeState.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
    if (swipeState.direction !== 'horizontal') return;

    event.preventDefault();
    if (deltaX <= -40) {
      closeOpenCards(swipeState.wrap);
      swipeState.wrap.classList.add('open');
    } else if (deltaX >= 40) {
      swipeState.wrap.classList.remove('open');
    }
  }, { passive: false });

  function finishSwipe(event, cancelled = false) {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;
    const { wrap, direction, wasOpen } = swipeState;
    const deltaX = event.clientX - swipeState.startX;
    swipeState = null;
    if (cancelled) {
      wrap.classList.toggle('open', wasOpen);
      return;
    }
    if (direction !== 'horizontal') {
      if (!direction && wasOpen) wrap.classList.remove('open');
      return;
    }
    if (deltaX <= -40) {
      if (wasOpen) wrap.classList.remove('open');
      else {
        closeOpenCards(wrap);
        wrap.classList.add('open');
      }
    } else if (deltaX >= 40) {
      wrap.classList.remove('open');
    } else {
      wrap.classList.toggle('open', wasOpen);
    }
  }

  document.addEventListener('pointerup', (event) => finishSwipe(event));
  document.addEventListener('pointercancel', (event) => finishSwipe(event, true));

  document.addEventListener('click', (event) => {
    const copyButton = event.target.closest('[data-copy-id]');
    const retryButton = event.target.closest('[data-retry-id]');
    const categoryButton = event.target.closest('[data-category]');
    const deleteButton = event.target.closest('[data-delete-id]');
    if (deleteButton) {
      void deleteMemo(deleteButton.dataset.deleteId);
      return;
    }
    if (copyButton) copyMemo(copyButton.dataset.copyId, copyButton);
    if (retryButton) organizeMemo(retryButton.dataset.retryId);
    if (categoryButton) {
      selectedCategory = categoryButton.dataset.category;
      render();
    }
    if (!event.target.closest('.card-wrap')) closeOpenCards();
  });
  elements.saveButton.addEventListener('click', saveMemo);
  elements.micButton.addEventListener('click', toggleSpeechRecognition);
  elements.searchInput.addEventListener('input', render);
  elements.apiKeyInput.value = apiKey();
  elements.apiKeyInput.addEventListener('input', () => localStorage.setItem(API_KEY_STORAGE, elements.apiKeyInput.value.trim()));
  elements.connectionTest.addEventListener('click', testConnection);
  elements.backupButton.addEventListener('click', downloadBackup);
  elements.loginForm.addEventListener('submit', submitLogin);
  elements.logoutButton.addEventListener('click', logout);
  elements.migrationButton.addEventListener('click', migrateMemos);
  elements.migrationLater.addEventListener('click', closeMigrationDialog);

  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => setOffline(false));

  db.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      if (session) void showLoggedIn(session);
      else showLoggedOut();
    }, 0);
  });

  async function initializeAuth() {
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (data.session) await showLoggedIn(data.session);
      else showLoggedOut();
    } catch (error) {
      handleSupabaseError(error);
      showLoggedOut();
      elements.loginError.textContent = error.message;
    }
  }

  setOffline(!navigator.onLine);
  void initializeAuth();
  window.setInterval(renderSyncStatus, 60 * 1000);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
})();
