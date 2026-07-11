(() => {
  'use strict';

  const MEMOS_KEY = 'ideastock_memos';
  const API_KEY_STORAGE = 'ideastock_apikey';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-haiku-4-5-20251001';

  const elements = {
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
    toast: document.getElementById('toast')
  };

  let selectedCategory = 'すべて';
  let recognition = null;
  let isRecording = false;
  let speechPrefix = '';
  let toastTimer = null;
  let swipeState = null;

  function readMemos() {
    try {
      const stored = JSON.parse(localStorage.getItem(MEMOS_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter((memo) => memo && typeof memo.text === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function writeMemos(memos) {
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  }

  function sortNewest(memos) {
    return [...memos].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function makeId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    const memos = sortNewest(readMemos());
    const categories = [...new Set(memos.map((memo) => memo.category).filter(Boolean))];
    if (selectedCategory !== 'すべて' && !categories.includes(selectedCategory)) selectedCategory = 'すべて';

    elements.recentMemos.innerHTML = memos.slice(0, 5).map(memoCard).join('') || '<p class="empty">まだメモはありません</p>';
    elements.categoryChips.innerHTML = ['すべて', ...categories].map((category) => (
      `<button class="chip ${category === selectedCategory ? 'on' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    )).join('');

    const query = elements.searchInput.value.trim().toLocaleLowerCase('ja-JP');
    const visibleMemos = memos.filter((memo) => {
      const searchable = [memo.text, memo.title, ...(Array.isArray(memo.tags) ? memo.tags : [])].join(' ').toLocaleLowerCase('ja-JP');
      return (selectedCategory === 'すべて' || memo.category === selectedCategory) && (!query || searchable.includes(query));
    });
    elements.memoList.innerHTML = visibleMemos.map(memoCard).join('') || '<p class="empty">該当するメモはありません</p>';
    elements.memoCount.textContent = `メモは全部このスマホの中に保存されています。現在 ${memos.length}件。`;
  }

  function showToast(message = '📋 クリップボードにコピーしました') {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 1500);
  }

  async function copyMemo(id, button) {
    const memo = readMemos().find((item) => item.id === id);
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

  function deleteMemo(id) {
    const memos = readMemos();
    writeMemos(memos.filter((memo) => memo.id !== id));
    render();
    showToast('🗑 メモを削除しました');
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

  async function organizeMemo(id) {
    const memos = readMemos();
    const memo = memos.find((item) => item.id === id);
    if (!memo) return;

    memo.status = 'analyzing';
    writeMemos(memos);
    render();

    try {
      const categories = [...new Set(memos.map((item) => item.category).filter(Boolean))];
      const result = await callClaude(`次のアイデアメモを整理してください。既存カテゴリ: ${categories.length ? categories.join('、') : 'なし'}。\n\n本文: ${memo.text}\n\n日本語で、title（15字以内）、category（既存カテゴリに合うものがあれば必ず再利用。なければ新設）、tags（1〜3個）のJSONオブジェクトだけを返してください。説明やMarkdownは不要です。`);
      const organized = parseAiResult(result);
      const latestMemos = readMemos();
      const latestMemo = latestMemos.find((item) => item.id === id);
      if (!latestMemo) return;
      Object.assign(latestMemo, organized, { status: 'done' });
      writeMemos(latestMemos);
    } catch (_) {
      const latestMemos = readMemos();
      const latestMemo = latestMemos.find((item) => item.id === id);
      if (latestMemo) {
        latestMemo.status = 'unsorted';
        writeMemos(latestMemos);
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
    const memos = readMemos();
    const memo = { id: makeId(), text, createdAt: new Date().toISOString(), title: '', category: '', tags: [], status: 'analyzing' };
    memos.push(memo);
    writeMemos(memos);
    elements.memoInput.value = '';
    render();
    await organizeMemo(memo.id);
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
    const data = JSON.stringify(sortNewest(readMemos()), null, 2);
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

  function switchScreen(name) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `${name}-screen`));
    document.querySelectorAll('nav button').forEach((button) => button.classList.toggle('on', button.dataset.screen === name));
    if (name === 'list') render();
  }

  document.querySelector('nav').addEventListener('click', (event) => {
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
      deleteMemo(deleteButton.dataset.deleteId);
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

  render();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
})();
