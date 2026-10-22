(() => {
  'use strict';
  const pets = {
    mantou: { name: '无糖白馒头', path: './mantou-card/', background: '#e8f1f7' },
    sheep: { name: '黑脸小羊', path: '../blackface-sheep/dist/', background: '#eeeade' },
    moge: { name: '墨格', path: '../moge-card/dist/', background: '#d5dce6' },
    gemini: { name: '小星灵（Gemini）', path: './gemini-card/', background: '#F6F0E6', cardSelector: '.ig-card', contentSelector: 'body', themeElement: 'body', tokens: { page: '--bg-page', ink: '--text-main', accent: '--accent-coral' } },
    deepseek: { name: '小深（DeepSeek）', path: './deepseek-card/', background: '#EDF1FA', cardSelector: '#card', contentSelector: '.wrap', tokens: { page: '--page-bg' } },
    hunyuan: { name: '喵仔（混元 WorkBuddy）', path: './hunyuan-card/', background: '#F2E9DB', cardSelector: '#card', contentSelector: '.app' },
  };
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panel = document.querySelector('#pet-panel');
  const frame = document.querySelector('#pet-frame');
  const loading = document.querySelector('#loading');
  const error = document.querySelector('#load-error');
  const meta = document.querySelector('meta[name="theme-color"]');
  let selected;
  let timeout;
  let resizeObserver;
  let themeObserver;
  let resizeFrame = () => {};

  function setBackground(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--page', color);
    meta.content = color;
  }
  function fail() {
    clearTimeout(timeout);
    loading.hidden = true;
    error.hidden = false;
    frame.classList.remove('is-loading');
    frame.hidden = true;
    panel.setAttribute('aria-busy', 'false');
  }
  function selectPet(id, force = false) {
    if (!Object.hasOwn(pets, id)) id = 'mantou';
    if (id === selected && !force) return;
    selected = id;
    const pet = pets[id];
    clearTimeout(timeout);
    resizeObserver?.disconnect();
    themeObserver?.disconnect();
    resizeFrame = () => {};
    document.body.dataset.pet = id;
    document.title = `${pet.name} · 桌面小伙伴`;
    setBackground(pet.background);
    document.querySelector('#open-pet').href = pet.path;
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.setAttribute('aria-busy', 'true');
    tabs.forEach(tab => {
      const active = tab.dataset.pet === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    loading.hidden = false;
    error.hidden = true;
    frame.classList.add('is-loading');
    frame.hidden = true;
    frame.title = `${pet.name}互动页面`;
    // Replacing embedded navigation leaves browser history to the outer tabs.
    frame.contentWindow.location.replace(new URL(pet.path, location.href).href);
    timeout = setTimeout(fail, 15000);
  }
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      const expected = new URL(pets[selected].path, location.href);
      if (doc.location.pathname !== expected.pathname && doc.location.pathname !== `${expected.pathname}index.html`) return;
      const config = pets[selected];
      const card = doc.querySelector(config.cardSelector || '.pet-card');
      const main = doc.querySelector(config.contentSelector || 'main');
      if (!card || !main) return fail();
      const style = doc.createElement('style');
      style.textContent = ':root,body{min-width:0;background:transparent!important}main{min-height:0;padding:16px 16px 24px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}@media(max-width:500px){main{padding:16px 12px 20px}}';
      if (config.contentSelector === '.wrap') style.textContent = ':root,body{min-width:0;background:transparent!important}.wrap{min-height:0;padding:16px 16px 24px;justify-content:flex-start}@media(max-width:500px){.wrap{padding:16px 12px 20px}}';
      if (config.contentSelector === 'body') style.textContent += 'body{min-height:0;padding:16px 16px 24px}@media(max-width:500px){body{padding:16px 12px 20px}}';
      if (config.contentSelector === '.app') style.textContent += 'body{min-height:0}.app{margin:0 auto}';
      // Hide the standalone diary additions only inside this presentation page.
      if (selected === 'mantou') style.textContent += '.diary-nav,.offline-status,.mood-caption{display:none!important}';
      doc.head.append(style);
      loading.hidden = true;
      error.hidden = true;
      frame.hidden = false;
      frame.classList.remove('is-loading');
      clearTimeout(timeout);
      panel.setAttribute('aria-busy', 'false');
      resizeFrame = () => { frame.style.height = `${Math.ceil(main.getBoundingClientRect().height)}px`; };
      resizeFrame();
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(resizeFrame);
        resizeObserver.observe(main);
      }
      const syncTheme = () => {
        const css = frame.contentWindow.getComputedStyle(main === doc.body ? doc.body : doc.documentElement);
        setBackground(css.getPropertyValue(config.tokens?.page || '--page').trim());
        for (const name of ['ink', 'accent']) {
          const color = css.getPropertyValue(config.tokens?.[name] || `--${name}`).trim();
          if (color) document.documentElement.style.setProperty(`--${name}`, color);
        }
      };
      syncTheme();
      themeObserver = new MutationObserver(syncTheme);
      themeObserver.observe(config.themeElement === 'body' ? doc.body : doc.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    } catch { fail(); }
  });
  frame.addEventListener('error', fail);
  function navigate(id) {
    if (location.hash === `#${id}`) selectPet(id);
    else location.hash = id;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => navigate(tab.dataset.pet));
    tab.addEventListener('keydown', event => {
      const next = { ArrowDown: (index + 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, ArrowUp: (index + tabs.length - 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus();
      navigate(tabs[next].dataset.pet);
    });
  });
  window.addEventListener('resize', () => resizeFrame());
  window.addEventListener('hashchange', () => selectPet(location.hash.slice(1)));
  document.querySelector('#retry').addEventListener('click', () => selectPet(selected, true));

  const promptDialog = document.querySelector('#prompt-dialog');
  const promptText = document.querySelector('#prompt-text');
  const promptStatus = document.querySelector('#prompt-status');
  const copyPrompt = document.querySelector('#copy-prompt');
  const selectPrompt = document.querySelector('#select-prompt');
  let promptValue;
  document.querySelector('#open-prompt').addEventListener('click', async () => {
    promptDialog.showModal();
    promptStatus.textContent = '';
    if (promptValue !== undefined) return;
    copyPrompt.disabled = selectPrompt.disabled = true;
    promptText.value = '';
    promptText.placeholder = '正在读取 Prompt…';
    try {
      const response = await fetch('prompt.txt');
      if (!response.ok) throw Error('Prompt unavailable');
      const value = await response.text();
      if (!value.trim()) throw Error('Empty prompt');
      promptValue = value;
      promptText.value = value;
      copyPrompt.disabled = selectPrompt.disabled = false;
    } catch {
      promptText.placeholder = '暂时没能读取 Prompt。';
      promptStatus.textContent = '请关闭后重新打开，再试一次。';
    }
  });
  document.querySelector('#close-prompt').addEventListener('click', () => promptDialog.close());
  promptDialog.addEventListener('click', event => {
    if (event.target !== promptDialog) return;
    const rect = promptDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) promptDialog.close();
  });
  function selectAllPrompt() {
    promptText.focus();
    promptText.select();
    promptText.setSelectionRange(0, promptText.value.length);
  }
  selectPrompt.addEventListener('click', () => {
    selectAllPrompt();
    promptStatus.textContent = '已全选，可以复制或按 Ctrl+C（Mac：⌘C）。';
  });
  copyPrompt.addEventListener('click', async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptValue);
        copied = true;
      }
    } catch { /* The selected text remains available when clipboard permission is denied. */ }
    if (!copied) {
      selectAllPrompt();
      try { copied = document.execCommand('copy'); } catch {}
    }
    promptStatus.textContent = copied ? '已复制全文，粘贴后就能使用。' : '已全选，请按 Ctrl+C（Mac：⌘C），手机可长按复制。';
  });
  selectPet(location.hash.slice(1));
})();
