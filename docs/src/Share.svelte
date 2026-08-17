<script>
  import { onMount, onDestroy } from 'svelte';
  import { compile } from '../../src/compile.ts';
  import { decodeShare, shareToken } from '../../src/share.ts';

  const DESMOS_API = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';

  let state = 'loading';
  let error = '';
  let source = '';
  let copied = false;
  let container;
  let calculator = null;

  function loadDesmos() {
    if (window.Desmos) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = DESMOS_API;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('the Desmos api did not load'));
      document.head.appendChild(script);
    });
  }

  function draw(list) {
    calculator = window.Desmos.GraphingCalculator(container, {
      expressionsList: false,
      expressions: false,
      settingsMenu: false,
      keypad: false,
      border: false,
      backgroundColor: '#0e1420',
      textColor: '#5d6878',
    });
    calculator.setExpressions(list.map(({ slider, ...rest }) => rest));
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      error = 'the clipboard is not available here';
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shared.dsmx';
    a.click();
    URL.revokeObjectURL(url);
  }

  onMount(async () => {
    const token = shareToken(window.location.hash);
    if (!token) {
      state = 'error';
      error = 'this link carries no graph';
      return;
    }

    const decoded = await decodeShare(token);
    if (decoded === null) {
      state = 'error';
      error = 'this link is damaged, or it was cut short by the app that sent it';
      return;
    }
    source = decoded;

    const result = compile(source);
    if (!result.success) {
      state = 'error';
      error = result.errors[0]?.message ?? 'the shared source does not compile';
      return;
    }

    state = 'ready';
    try {
      await loadDesmos();
      draw(result.state.expressions.list);
    } catch (err) {
      state = 'error';
      error = err.message;
    }
  });

  onDestroy(() => calculator?.destroy());
</script>

<svelte:head>
  <title>shared graph | desmos ide</title>
  <meta name="description" content="A Desmos graph shared as dsmx source." />
</svelte:head>

<div class="share">
  <header>
    <a class="brand" href="/">desmos ide</a>
    <span class="sep">/</span>
    <span class="what">shared graph</span>
    <span class="spacer"></span>
    {#if state === 'ready'}
      <button on:click={copySource}>{copied ? 'copied' : 'copy source'}</button>
      <button on:click={download}>download .dsmx</button>
    {/if}
  </header>

  {#if state === 'error'}
    <div class="notice">{error}</div>
  {:else}
    <div class="split">
      <div class="graph" bind:this={container}></div>
      <pre class="source">{source}</pre>
    </div>
    {#if error}<div class="notice">{error}</div>{/if}
  {/if}
</div>

<style>
  .share {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 16px;
    gap: 12px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
  }

  .brand { color: var(--text); text-decoration: none; font-family: var(--font-display); }
  .sep, .what { color: var(--soft); }
  .spacer { flex: 1; }

  header button {
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    cursor: pointer;
  }
  header button:hover { color: var(--text); border-color: var(--border-strong); }

  .split {
    flex: 1;
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 12px;
    min-height: 0;
  }

  .graph,
  .source {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .source {
    margin: 0;
    padding: 16px;
    background: var(--code-bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.7;
    overflow: auto;
    white-space: pre;
  }

  .notice {
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    color: var(--muted);
  }

  @media (max-width: 860px) {
    .split { grid-template-columns: 1fr; grid-template-rows: 1.2fr 1fr; }
  }
</style>
