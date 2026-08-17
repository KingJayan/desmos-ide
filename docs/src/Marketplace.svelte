<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import Nav from './Nav.svelte';
  import { parseRegistry } from '../../src/plugin/manifest.ts';

  const INDEX = 'https://raw.githubusercontent.com/KingJayan/dsmx-registry/main/index.json';
  const REPO = 'https://github.com/KingJayan/dsmx-registry';

  let state = 'loading';
  let error = '';
  let plugins = [];
  let query = '';
  let selected = null;
  let copied = '';

  // /marketplace/<id> opens straight on that plugin, so a link can point at one
  function idFromPath() {
    const m = /^\/marketplace\/([a-z0-9-]+)\/?$/.exec(window.location.pathname);
    return m ? m[1] : null;
  }

  function open(id) {
    selected = id;
    const path = id ? `/marketplace/${id}` : '/marketplace';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  }

  async function copy(text, tag) {
    try {
      await navigator.clipboard.writeText(text);
      copied = tag;
      setTimeout(() => (copied = ''), 1600);
    } catch {
      error = 'the clipboard is not available here';
    }
  }

  function parts(manifest) {
    const out = [];
    if (manifest.lib) out.push('dsl');
    if (manifest.main) out.push('code');
    if (manifest.theme) out.push('theme');
    return out;
  }

  onMount(async () => {
    window.addEventListener('popstate', () => (selected = idFromPath()));
    try {
      const res = await fetch(INDEX);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      plugins = parseRegistry(await res.json()).plugins;
      state = 'ready';
      selected = idFromPath();
    } catch (err) {
      state = 'error';
      error = `the marketplace index did not load — ${err.message}`;
    }
  });

  $: shown = plugins.filter(p => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const m = p.manifest;
    return [m.name, m.id, m.description, m.author, ...(m.keywords ?? [])]
      .some(field => String(field).toLowerCase().includes(q));
  });

  $: current = selected ? plugins.find(p => p.manifest.id === selected) ?? null : null;
</script>

<svelte:head>
  <title>marketplace | desmos ide</title>
  <meta name="description" content="Plugins for desmos-ide: generators, DSL libraries and themes." />
</svelte:head>

<Nav route="marketplace" />

<main class="wrap">
  {#if current}
    <button class="back" on:click={() => open(null)}>
      <Icon icon="lucide:arrow-left" />all plugins
    </button>

    <article class="detail">
      <header>
        <div class="detail-icon">{current.manifest.icon ?? '◆'}</div>
        <div>
          <h1>{current.manifest.name}</h1>
          <div class="facts">
            <span>{current.manifest.author}</span>
            <span>v{current.manifest.version}</span>
            <span>{current.manifest.license ?? 'no license'}</span>
          </div>
          <p class="lede">{current.manifest.description}</p>

          <div class="actions">
            <a class="btn btn-primary" href={`dsmx://plugin/${current.manifest.id}`}>
              <Icon icon="lucide:download" />open in desmos ide
            </a>
            <button class="btn" on:click={() => copy(current.manifest.id, 'id')}>
              {copied === 'id' ? 'copied' : 'copy plugin id'}
            </button>
            <a class="btn" href={`${REPO}/tree/main/${current.path}`} target="_blank" rel="noreferrer">
              <Icon icon="lucide:code" />source
            </a>
          </div>
        </div>
      </header>

      <section class="how">
        <h2>installing</h2>
        <p>
          Open in desmos ide takes you to the plugin's page in the app, where you can read it
          and install it. If the app does not answer, open the plugins sidebar with
          <kbd>⌘7</kbd>, search for the name and install it there.
        </p>

        <h2>pinning it</h2>
        <p>
          A file that needs this plugin should say so, so it fails loudly on a machine
          without it instead of quietly drawing nothing:
        </p>
        <pre><code>use "{current.manifest.id}"</code></pre>

        <h2>what it adds</h2>
        <ul class="adds">
          {#if current.manifest.lib}
            <li><span class="tag tag-dsl">dsl</span>functions you can call from any file</li>
          {/if}
          {#if current.manifest.main}
            <li><span class="tag tag-code">code</span>generators and commands, run in a sandbox with no network and no DOM</li>
          {/if}
          {#if current.manifest.theme}
            <li><span class="tag tag-theme">theme</span>an editor colour theme</li>
          {/if}
        </ul>
      </section>
    </article>
  {:else}
    <header class="head">
      <h1>marketplace</h1>
      <p>
        Plugins add generators, DSL libraries and themes. They run on your machine only —
        a share link carries the file, never the plugin.
      </p>
      <div class="search">
        <Icon icon="lucide:search" />
        <input bind:value={query} placeholder="search plugins" aria-label="search plugins" />
      </div>
    </header>

    {#if state === 'loading'}
      <p class="notice">loading the index…</p>
    {:else if state === 'error'}
      <p class="notice">{error}</p>
    {:else if shown.length === 0}
      <p class="notice">nothing matches “{query}”.</p>
    {:else}
      <div class="grid">
        {#each shown as plugin (plugin.manifest.id)}
          <button class="card" on:click={() => open(plugin.manifest.id)}>
            <div class="card-icon">{plugin.manifest.icon ?? '◆'}</div>
            <div class="card-body">
              <div class="card-title">
                <span class="card-name">{plugin.manifest.name}</span>
                <span class="card-version">v{plugin.manifest.version}</span>
              </div>
              <p class="card-desc">{plugin.manifest.description}</p>
              <div class="card-foot">
                <span class="card-author">{plugin.manifest.author}</span>
                {#each parts(plugin.manifest) as part}
                  <span class="tag tag-{part}">{part}</span>
                {/each}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <section class="submit">
      <h2>publishing your own</h2>
      <p>
        The registry is a repo. Add a folder under <code>plugins/</code>, add your entry to
        <code>index.json</code> and open a pull request. Every plugin is read by hand before
        it merges.
      </p>
      <a class="btn" href={REPO} target="_blank" rel="noreferrer">
        <Icon icon="simple-icons:github" />the registry repo
      </a>
    </section>
  {/if}
</main>

<style>
  .wrap {
    max-width: 1040px;
    margin: 0 auto;
    padding: 48px 20px 80px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 2.2rem;
  }

  .head p {
    max-width: 60ch;
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 380px;
    margin-top: 22px;
    padding: 9px 13px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    color: var(--soft);
  }

  .search input {
    flex: 1;
    border: none;
    background: none;
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 0.9rem;
  }
  .search input:focus { outline: none; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
    margin-top: 30px;
  }

  .card {
    display: flex;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--panel);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.16s, transform 0.16s;
  }
  .card:hover { border-color: var(--border-strong); transform: translateY(-2px); }

  .card-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-2);
    font-size: 21px;
  }

  .card-body { min-width: 0; }

  .card-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .card-name {
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1rem;
  }

  .card-version { color: var(--soft); font-size: 0.72rem; }

  .card-desc {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.86rem;
    line-height: 1.55;
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 11px;
  }

  .card-author { color: var(--soft); font-size: 0.74rem; }

  .tag {
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 0.68rem;
    letter-spacing: 0.02em;
  }
  .tag-dsl { color: var(--accent); }
  .tag-code { color: #c3b0ff; }
  .tag-theme { color: var(--accent-2); }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 22px;
    border: none;
    background: none;
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .back:hover { color: var(--text); }

  .detail header {
    display: flex;
    gap: 20px;
    padding-bottom: 26px;
    border-bottom: 1px solid var(--border);
  }

  .detail-icon {
    flex-shrink: 0;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--panel);
    font-size: 34px;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
    color: var(--soft);
    font-size: 0.8rem;
  }

  .lede {
    max-width: 62ch;
    margin: 12px 0 0;
    color: var(--muted);
    line-height: 1.65;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    text-decoration: none;
    cursor: pointer;
  }
  .btn:hover { color: var(--text); border-color: var(--border-strong); }

  .btn-primary {
    border-color: transparent;
    background: var(--accent);
    color: #08111a;
  }
  .btn-primary:hover { color: #08111a; filter: brightness(1.06); }

  .how { margin-top: 30px; max-width: 68ch; }

  .how h2 {
    margin: 28px 0 8px;
    font-family: var(--font-display);
    font-size: 1.05rem;
  }
  .how h2:first-child { margin-top: 0; }

  .how p { margin: 0; color: var(--muted); line-height: 1.7; }

  pre {
    margin: 12px 0 0;
    padding: 13px 15px;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--code-bg);
  }

  code {
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }

  kbd {
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-2);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .adds {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
  }

  .adds li {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 0.88rem;
  }

  .notice {
    margin-top: 30px;
    padding: 16px 18px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel);
    color: var(--muted);
  }

  .submit {
    margin-top: 56px;
    padding-top: 28px;
    border-top: 1px solid var(--border);
    max-width: 68ch;
  }

  .submit h2 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-size: 1.05rem;
  }

  .submit p { margin: 0 0 16px; color: var(--muted); line-height: 1.7; }
  .submit code { font-size: 0.8rem; }

  @media (max-width: 640px) {
    .detail header { flex-direction: column; gap: 14px; }
  }
</style>
