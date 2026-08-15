<script>
  import { onMount, onDestroy } from 'svelte';
  import { highlightSnippets } from './highlight.js';
  import pkg from '../package.json';
  import dsl from '../../package.json';

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const route = /^\/docs(?:\/|$)/.test(path)
    ? 'docs'
    : /^\/download\/electron(?:\/|$)/.test(path)
      ? 'download-electron'
      : /^\/download\/extension(?:\/|$)/.test(path)
        ? 'download-extension'
        : 'home';

  const routeTitle = route === 'docs'
    ? 'docs | desmos dsl'
    : route === 'download-electron'
      ? 'electron ide download | desmos ide'
      : route === 'download-extension'
        ? 'vscode extension | desmos ide'
        : 'desmos ide | docs and tools';

  const routeDescription = route === 'docs'
    ? 'Detailed documentation for the Desmos IDE DSL.'
    : route === 'download-electron'
      ? 'Download page placeholder for the Desmos IDE Electron app.'
      : route === 'download-extension'
        ? 'Download page placeholder for the Desmos IDE VS Code extension.'
        : 'Landing page for Desmos IDE tools, docs, and download placeholders.';

  const downloadPage = route === 'download-electron'
    ? {
      eyebrow: 'desktop app',
      title: 'electron ide download',
      summary: 'The Electron build is not released yet. This page will host installers and release notes once packaging is ready.',
      chips: ['macOS coming soon', 'windows coming soon', 'linux coming soon'],
    }
    : route === 'download-extension'
      ? {
        eyebrow: 'vscode extension',
        title: 'extension download',
        summary: 'The VS Code extension is not released yet. This page will host the marketplace link and changelog when it ships.',
        chips: ['marketplace link soon', 'manual .vsix soon', 'docs integration planned'],
      }
      : null;

  const homeSignals = [
    { label: 'docs', value: 'language reference' },
    { label: 'desktop', value: 'electron ide' },
    { label: 'extension', value: 'VS Code extension' },
    { label: 'core', value: 'compiler pipeline' },
  ];

  const homeProducts = [
    {
      kicker: 'desktop app',
      title: 'Electron IDE',
      copy: 'interactive graphing with a built-in compiler. edit with Monaco, run the full pipeline locally, and iterate in real time.',
      href: '/download/electron',
      links: [
        { href: '/download/electron', label: 'download' },
        { href: 'https://github.com/KingJayan/desmos-ide', label: 'view source' },
        { href: '/docs', label: 'docs' },
      ],
      featured: true,
    },
    {
      kicker: 'reference',
      title: 'DSL docs',
      copy: 'detailed syntax, semantics, and compiler behavior—with dense examples and section-level navigation.',
      href: '/docs',
      links: [{ href: '/docs', label: 'read the docs' }],
    },
    {
      kicker: 'editor slot',
      title: 'VS Code extension',
      copy: 'editor-native tooling (in progress).',
      href: '/download/extension',
      links: [{ href: '/download/extension', label: 'download' }],
      muted: true,
    },
  ];

  const navItems = [
    { id: 'quick-start', label: 'quick start' },
    { id: 'lexical-rules', label: 'lexical rules' },
    { id: 'top-level', label: 'top-level statements' },
    { id: 'expressions', label: 'expressions' },
    { id: 'conditionals', label: 'conditionals' },
    { id: 'domain', label: 'domain restriction' },
    { id: 'geometry', label: 'geometry' },
    { id: 'curves', label: 'curves & regions' },
    { id: 'generators-map', label: 'map generator' },
    { id: 'expr-block', label: 'expr block' },
    { id: 'debug', label: 'debug' },
    { id: 'styling', label: 'styling' },
    { id: 'animation', label: 'sliders & animation' },
    { id: 'builtins', label: 'built-ins' },
    { id: 'codegen', label: 'codegen' },
    { id: 'optimizer', label: 'optimizer' },
    { id: 'errors', label: 'errors' },
    { id: 'limitations', label: 'limitations' },
  ];

  const summaryCards = [
    {
      title: 'Start here',
      kicker: 'orientation',
      copy: 'The fastest route into the DSL: syntax shape, statement forms, and the smallest useful examples.',
      links: [
        { id: 'quick-start', label: 'quick start' },
        { id: 'lexical-rules', label: 'lexical rules' },
        { id: 'top-level', label: 'top-level statements' },
      ],
    },
    {
      title: 'Language core',
      kicker: 'syntax',
      copy: 'Expressions, branching, domains, blocks, and debug-only constructs that shape the AST.',
      links: [
        { id: 'expressions', label: 'expressions' },
        { id: 'conditionals', label: 'conditionals' },
        { id: 'domain', label: 'domain restriction' },
        { id: 'expr-block', label: 'expr block' },
      ],
    },
    {
      title: 'Geometry layer',
      kicker: 'drawing',
      copy: 'Point, line, region, curve, and generator statements, plus the styling model that makes them feel alive.',
      links: [
        { id: 'geometry', label: 'geometry' },
        { id: 'curves', label: 'curves & regions' },
        { id: 'generators-map', label: 'map generator' },
        { id: 'styling', label: 'styling' },
        { id: 'animation', label: 'sliders & animation' },
      ],
    },
    {
      title: 'Compiler surface',
      kicker: 'runtime',
      copy: 'Built-ins, code generation, optimizer behavior, error phases, and the remaining sharp edges.',
      links: [
        { id: 'builtins', label: 'built-ins' },
        { id: 'codegen', label: 'codegen' },
        { id: 'optimizer', label: 'optimizer' },
        { id: 'errors', label: 'errors' },
        { id: 'limitations', label: 'limitations' },
      ],
    },
  ];

  let activeId = '';
  let scrollPct = 0;
  let observers = [];

  onMount(() => {
    if (route !== 'docs') return;

    highlightSnippets();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) activeId = e.target.id;
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    navItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    observers.push(io);

    const onScroll = () => {
      const doc = document.documentElement;
      scrollPct = doc.scrollTop / (doc.scrollHeight - doc.clientHeight) * 100;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    observers.push({ disconnect: () => window.removeEventListener('scroll', onScroll) });
  });

  onDestroy(() => observers.forEach(o => o.disconnect()));
</script>

<svelte:head>
  <title>{routeTitle}</title>
  <meta name="description" content={routeDescription} />
</svelte:head>

{#if route === 'home'}
  <main class="page landing">
    <header class="hero home-hero landing-hero">
      <div class="hero-copy">
        <p class="eyebrow">let's get started</p>
        <h1>desmos ide</h1>
        <p class="lede">
          a focused environment for building, creating, and experimenting with advanced desmos.

          docs define the language, the desktop app runs the graphing pipeline, and the VS Code extension brings tooling directly into your editor
        </p>
      </div>
      <aside class="hero-stage" aria-label="product map">
        <div class="hero-orbit">
          <div class="orbit-core">
            <span>core</span>
            <strong>compiler pipeline</strong>
          </div>
          <div class="orbit-node orbit-docs">
            <span>docs</span>
            <strong>lang reference</strong>
          </div>
          <div class="orbit-node orbit-desktop">
            <span>desktop</span>
            <strong>electron ide</strong>
          </div>
          <div class="orbit-node orbit-extension">
            <span>extension</span>
            <strong>vscode (wip)</strong>
          </div>
        </div>
        <div class="signal-head">
          <p class="summary-kicker">surface map</p>
          <p>docs, desktop app, and extension.</p>
        </div>
        <div class="signal-grid">
          {#each homeSignals as signal}
            <article>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
            </article>
          {/each}
        </div>
      </aside>
    </header>

    <section class="overview launch" aria-label="product atlas">
      <div class="overview-copy">
        <p class="eyebrow">products</p>
        <h2>choose a tool</h2>
        <p>
          each surface is designed for a different part of the workflow -- pick where you want to start.        
        </p>
      </div>
      <div class="launch-grid">
        {#each homeProducts as product}
          <article class="summary-card launch-card" class:launch-card-feature={product.featured} class:launch-card-muted={product.muted}>
            <p class="summary-kicker">{product.kicker}</p>
            <h3>
              {#if product.href}
                <a class="card-title-link" href={product.href}>{product.title}</a>
              {:else}
                {product.title}
              {/if}
            </h3>
            <p>{product.copy}</p>
            <ul>
              {#each product.links as link}
                <li>
                  {#if link.href}
                    <a href={link.href}>{link.label}</a>
                  {:else}
                    <span>{link.label}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>
    </section>

  </main>
{:else if route === 'download-electron' || route === 'download-extension'}
  <main class="page coming-page">
    <section class="coming-card" aria-label="download placeholder">
      <p class="eyebrow">{downloadPage.eyebrow}</p>
      <h1>{downloadPage.title}</h1>
      <p class="lede">{downloadPage.summary}</p>
      <div class="coming-chips" aria-label="release status">
        {#each downloadPage.chips as chip}
          <span class="meta-chip">{chip}</span>
        {/each}
      </div>
      <div class="coming-actions" aria-label="navigation links">
        <a class="meta-chip" href="/">back to landing</a>
        <a class="meta-chip" href="/docs">open docs</a>
        <a class="meta-chip" href="https://github.com/KingJayan/desmos-ide">github</a>
      </div>
    </section>
  </main>
{:else}
  <div class="progress" style="width: {scrollPct}%"></div>

  <main class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">desmos ide</p>
        <h1>dsl documentation</h1>
        <p class="lede">
          complete reference for the dsl implemented by the compiler in this repository.
          covers syntax, semantics, built-ins, geometry statements, codegen output, and known limitations.
        </p>
      </div>
      <div class="hero-meta" aria-label="documentation metadata">
        <span class="meta-chip">docs v{pkg.version}</span>
        <span class="meta-chip">dsl v{dsl.version}</span>
        <span class="meta-chip">{navItems.length} sections</span>
        <a class="meta-chip" href="/">landing page</a>
      </div>
      <div class="lens-strip" aria-label="reading lenses">
        <span class="lens-chip">syntax</span>
        <span class="lens-chip">examples</span>
        <span class="lens-chip">output</span>
        <span class="lens-chip">caveats</span>
      </div>
    </header>

    <nav class="toc" aria-label="table of contents">
      {#each navItems as item}
        <a href={`#${item.id}`} class:active={activeId === item.id}>{item.label}</a>
      {/each}
    </nav>

    <section class="overview" aria-label="section atlas">
      <div class="overview-copy">
        <p class="eyebrow">section atlas</p>
        <h2>where to read first</h2>
        <p>
          four quick paths into the reference. each card clusters related sections so the page stays
          scannable even when the individual references get dense.
        </p>
      </div>
      <div class="summary-grid">
        {#each summaryCards as card}
          <article class="summary-card">
            <p class="summary-kicker">{card.kicker}</p>
            <h3>{card.title}</h3>
            <p>{card.copy}</p>
            <ul>
              {#each card.links as link}
                <li><a href={`#${link.id}`}>{link.label}</a></li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>
    </section>

  <section id="quick-start">
    <h2>quick start</h2>
    <pre><code>// variables, sliders, aliases
a = slider(3, 0, 10, step=0.1, speed=1, loop)
fn hyp(x, y) = sqrt(x^2 + y^2)
alias dist = hyp(3, 4)

// geometry
point p (3, 4)
circle c &#123; center (0, 0)  radius 5 &#125;
line l = slope(1), intercept(0)
segment s = (0,0) -> (3,4)

// generators
pts = map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)
curve ring (t in 0..6.28) &#123; (cos(t), sin(t)) &#125;

// conditionals
v = if x > 0 then x^2 else -x
y = x^2 domain x > 0

// expr block — inlined at compile time
expr &#123;
  cx = cos(t)
  cy = sin(t)
  (2*cx, cy)
&#125;</code></pre>
    <div class="output-tags" aria-label="quick start output hints">
      <span class="output-tag">desmos output</span>
      <span class="output-tag">fn inlined</span>
      <span class="output-tag">expr block is compile-time only</span>
    </div>
  </section>

  <section id="lexical-rules">
    <h2>lexical rules</h2>
    <ul>
      <li><strong>comments:</strong> single-line, start with <code>//</code>.</li>
      <li><strong>whitespace:</strong> spaces, tabs, and newlines are ignored except for position tracking.</li>
      <li><strong>numbers:</strong> integers and decimals. write <code>0.5</code>, not <code>.5</code>.</li>
      <li><strong>identifiers:</strong> <code>[A-Za-z_][A-Za-z0-9_]*</code></li>
      <li><strong>keywords:</strong> <code>fn</code> <code>alias</code> <code>debug</code> <code>in</code> <code>map</code> <code>point</code> <code>circle</code> <code>line</code> <code>curve</code> <code>region</code> <code>polygon</code> <code>segment</code> <code>text</code> <code>group</code> <code>as</code> <code>at</code> <code>for</code> <code>step</code> <code>where</code> <code>else</code> <code>if</code> <code>then</code> <code>domain</code> <code>expr</code> <code>loop</code> <code>time</code> <code>project</code> <code>camera</code> <code>spiral</code> <code>wave</code> <code>grid</code></li>
      <li><strong>range tokens:</strong>
        <ul>
          <li><code>..</code> — range separator (<code>0..6.28</code>)</li>
          <li><code>-></code> — lambda separator in <code>map</code> / segment endpoint separator</li>
        </ul>
      </li>
      <li><strong>string literals:</strong> double-quoted, single-line only.</li>
    </ul>
    <pre><code>x = 3       // constant
// full-line comment</code></pre>
  </section>

  <section id="top-level">
    <h2>top-level statements</h2>
    <p>every statement must begin with a keyword or an identifier followed by <code>=</code>. the sole exception is <code>expr &#123;...&#125;</code> which emits a bare expression.</p>
    <table>
      <thead><tr><th>form</th><th>description</th></tr></thead>
      <tbody>
        <tr><td><code>name = expr</code></td><td>variable binding</td></tr>
        <tr><td><code>name = expr domain cond</code></td><td>variable with domain restriction</td></tr>
        <tr><td><code>name = slider(init, min, max, ...)</code></td><td>slider — see animation section</td></tr>
        <tr><td><code>alias name = expr</code></td><td>named alias (identical output to assignment)</td></tr>
        <tr><td><code>fn name(p1, ...) = expr</code></td><td>user-defined function (inlined by optimizer)</td></tr>
        <tr><td><code>debug expr</code></td><td>compile-time only — no desmos output</td></tr>
        <tr><td><code>expr &#123; bindings  result &#125;</code></td><td>inline expression block; bindings substituted into result at compile time</td></tr>
        <tr><td><code>point name (x, y)</code></td><td>named point</td></tr>
        <tr><td><code>circle name = circle((h, k), r)</code></td><td>circle — classic form</td></tr>
        <tr><td><code>circle name &#123; center (h, k)  radius r &#125;</code></td><td>circle — block form</td></tr>
        <tr><td><code>line name = slope(m), intercept(b)</code></td><td>line — slope-intercept</td></tr>
        <tr><td><code>line name = lhs = rhs</code></td><td>line — standard form</td></tr>
        <tr><td><code>segment name = (x1,y1) -> (x2,y2)</code></td><td>line segment</td></tr>
        <tr><td><code>polygon name = [(x,y), ...]</code></td><td>filled polygon</td></tr>
        <tr><td><code>curve name (v in start..end) &#123; body &#125;</code></td><td>parametric curve or sampled list</td></tr>
        <tr><td><code>name = body for v in start..end</code></td><td>inline for-comprehension</td></tr>
        <tr><td><code>name = map(v -> body, start..end step n)</code></td><td>map generator — compiles to list comprehension</td></tr>
        <tr><td><code>region name = inequality</code></td><td>filled inequality region</td></tr>
        <tr><td><code>text name = "label" at (x, y)</code></td><td>text label at position</td></tr>
        <tr><td><code>group name as "Folder label"</code></td><td>desmos folder</td></tr>
        <tr><td><code>spiral name = spiral(turns, spacing)</code></td><td>archimedean spiral</td></tr>
        <tr><td><code>wave name = wave(freq, amp)</code></td><td>sine wave</td></tr>
        <tr><td><code>grid name = grid(cols, rows)</code></td><td>cartesian grid lines</td></tr>
      </tbody>
    </table>
  </section>

  <section id="expressions">
    <h2>expressions</h2>
    <h3>operator precedence (lowest to highest)</h3>
    <ol>
      <li>comparison: <code>&lt;</code> <code>&gt;</code> <code>&lt;=</code> <code>&gt;=</code> <code>==</code> <code>!=</code></li>
      <li>addition and subtraction: <code>+</code>, <code>-</code></li>
      <li>multiplication and division: <code>*</code>, <code>/</code></li>
      <li>power: <code>^</code> (right-associative)</li>
      <li>unary minus: <code>-x</code></li>
    </ol>
    <p>example: <code>2^3^2</code> parses as <code>2^(3^2)</code> = 512.</p>

    <h3>expression forms</h3>
    <table>
      <thead><tr><th>form</th><th>example</th></tr></thead>
      <tbody>
        <tr><td>numeric literal</td><td><code>1</code>, <code>3.14</code></td></tr>
        <tr><td>identifier</td><td><code>x</code>, <code>theta</code></td></tr>
        <tr><td>binary op</td><td><code>a + b</code>, <code>a * b</code>, <code>a^b</code></td></tr>
        <tr><td>unary minus</td><td><code>-x</code></td></tr>
        <tr><td>function call</td><td><code>sin(x)</code>, <code>f(a, b)</code></td></tr>
        <tr><td>tuple (point)</td><td><code>(x, y)</code></td></tr>
        <tr><td>list range</td><td><code>[0, 0.1 ... 1]</code></td></tr>
        <tr><td>map generator</td><td><code>map(i -> expr, 0..6.28 step 0.1)</code></td></tr>
        <tr><td>conditional (where)</td><td><code>expr where cond else alt</code></td></tr>
        <tr><td>conditional (if)</td><td><code>if cond then a else b</code></td></tr>
        <tr><td>piecewise block</td><td><code>&#123; cond: val, else: val &#125;</code></td></tr>
      </tbody>
    </table>

    <h3>division and power latex output</h3>
    <p>division compiles to a fraction: <code>a / b</code> → <code>\frac&#123;a&#125;&#123;b&#125;</code>. power compiles to a superscript: <code>a^b</code> → <code>a^&#123;b&#125;</code>. parentheses are inserted automatically when precedence requires it.</p>
  </section>

  <section id="conditionals">
    <h2>conditionals</h2>

    <aside class="callout note">
      <strong>note</strong>
      <p>all three forms lower to the same piecewise output. the choice here is readability, not behavior.</p>
    </aside>

    <h3>where / else</h3>
    <pre><code>v = x^2 where x > 0 else -x</code></pre>
    <p>compiles to <code>&#123;x&gt;0:x^2,-x&#125;</code>.</p>
    <div class="output-tags" aria-label="conditional output hints">
      <span class="output-tag">piecewise</span>
      <span class="output-tag">same output as if/then/else</span>
    </div>

    <details class="example-stack">
      <summary>alternate forms</summary>
      <div class="example-stack-body">
        <h3>if / then / else</h3>
        <pre><code>v = if x > 0 then x^2 else -x</code></pre>
        <p>identical output to <code>where/else</code> — choose whichever reads more naturally.</p>

        <h3>piecewise block</h3>
        <p>multi-branch piecewise with an optional <code>else</code> fallback:</p>
        <pre><code>z = &#123; x > 0: x^2, x &lt; 0: -x, else: 0 &#125;</code></pre>
        <p>each <code>cond: val</code> pair maps to a desmos piecewise arm. the <code>else</code> branch is the fallback value.</p>
      </div>
    </details>
  </section>

  <section id="domain">
    <h2>domain restriction</h2>
    <p>append <code>domain cond</code> to any variable binding to restrict where the expression is drawn:</p>
    <aside class="callout note">
      <strong>note</strong>
      <p>this only filters the visible domain. it does not create a new shape or change the underlying expression.</p>
    </aside>
    <pre><code>y = x^2 domain x > 0       // only draws for x > 0
w = sin(x) domain x >= -pi  // only draws for x >= -π</code></pre>
    <p>compiles to <code>y=x^{"{"}2{"}"}\left\{"{"}x&gt;0{"\}"}\right\}</code> — desmos domain filter notation.</p>
    <div class="output-tags" aria-label="domain output hints">
      <span class="output-tag">desmos domain filter</span>
      <span class="output-tag">render-only constraint</span>
    </div>
  </section>

  <section id="geometry">
    <h2>geometry</h2>
    <p>all geometry statements support an optional <code>as &#123; ... &#125;</code> styling suffix (see the <a href="#styling">styling</a> section).</p>

    <h3>point</h3>
    <pre><code>point p (1, 2)
point q (a, b)   // dynamic coordinates</code></pre>
    <p>renders a labeled point. coordinates can be any expression. compiles to a desmos expression with <code>showLabel: true</code> and <code>label</code> set to the point name.</p>

    <h3>circle</h3>
    <p>two equivalent forms:</p>
    <pre><code>circle c &#123; center (0, 0)  radius 5 &#125;    // block form
circle d = circle((a, b), r)              // classic form</code></pre>
    <p>compiles to the implicit equation <code>(x-h)²+(y-k)²=r²</code> with fill enabled at opacity <code>0.1</code>.</p>

    <h3>line</h3>
    <p>two supported syntactic forms:</p>
    <table>
      <thead><tr><th>form</th><th>example</th><th>compiled latex</th></tr></thead>
      <tbody>
        <tr><td>slope-intercept</td><td><code>line l = slope(2), intercept(1)</code></td><td><code>y=2x+1</code></td></tr>
        <tr><td>standard form</td><td><code>line l = 2*x + y = 4</code></td><td><code>2x+y=4</code></td></tr>
      </tbody>
    </table>
    <p>when slope is <code>1</code> the coefficient is omitted; when intercept is <code>0</code> the constant term is omitted.</p>

    <h3>segment</h3>
    <pre><code>segment s = (0, 0) -> (1, 1)
segment d = (a, b) -> (c, d)</code></pre>
    <p>compiles to a desmos polygon with two vertices, which renders as a line segment.</p>

    <h3>polygon</h3>
    <pre><code>polygon tri = [(0,0), (1,0), (0,1)]
polygon sq  = [(0,0), (2,0), (2,2), (0,2)]</code></pre>
    <p>compiles to a desmos polygon expression. vertices are a literal list of tuples. fill is enabled by default.</p>

    <h3>text</h3>
    <pre><code>text lbl = "hello" at (1, 2)
text note = "f(x) = x²" at (0, 5)</code></pre>
    <p>compiles to a desmos note expression with the label string and position set.</p>

    <h3>group</h3>
    <pre><code>group g as "My Folder"</code></pre>
    <p>compiles to a desmos folder expression. subsequent expressions are placed inside the folder until the next <code>group</code> statement or end of program.</p>
  </section>

  <section id="curves">
    <h2>curves &amp; regions</h2>

    <h3>parametric curve — block form</h3>
    <p>the <code>curve</code> keyword binds a parameter variable over a numeric range and evaluates the body for each sample. a tuple body produces a parametric curve; a scalar body produces a sampled list.</p>
    <pre><code>// parametric curve (tuple body)
curve ring (t in 0..6.28) &#123;
  (cos(t), sin(t))
&#125;

// sampled list (scalar body)
curve vals (n in 0..10) &#123;
  n^2
&#125;</code></pre>
    <p>the range <code>start..end</code> is passed directly to desmos as the parametric domain.</p>

    <h3>inline for-comprehension</h3>
    <p>a compact alternative to the block <code>curve</code>:</p>
    <pre><code>pts = (cos(t), sin(t)) for t in 0..6.28</code></pre>
    <p>semantically equivalent to the block form. compiles to the same desmos parametric expression.</p>

    <h3>region</h3>
    <p>any inequality or boolean expression can be a region body:</p>
    <pre><code>region r  = y > x^2
region s  = x^2 + y^2 &lt; 9
region r2 = y &lt; x as &#123; color blue opacity 0.3 fill &#125;</code></pre>
    <p>compiles to a desmos expression that renders as a shaded region.</p>
  </section>

  <section id="generators-map">
    <h2>map generator</h2>
    <p><code>map(variable -> expression, start..end step n)</code> is a list comprehension that compiles to a desmos list expression. no runtime iteration — the range and body are lowered to static desmos notation.</p>
    <pre><code>// list of points on a unit circle
pts = map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)

// list of y values
ys = map(t -> sin(t) * cos(t), 0..3.14 step 0.05)

// as a variable value
v = map(n -> n^2, 1..10 step 1)</code></pre>

    <h3>compiled output</h3>
    <p><code>map(i -> (cos(i), sin(i)), 0..6.28 step 0.1)</code> compiles to:</p>
    <pre class="no-highlight"><code>\left[\left(\cos\left(i\right),\sin\left(i\right)\right)\operatorname&#123;for&#125;i=\left[0,0.1,...,6.28\right]\right]</code></pre>

    <h3>range syntax</h3>
    <table>
      <thead><tr><th>form</th><th>meaning</th></tr></thead>
      <tbody>
        <tr><td><code>0..6.28</code></td><td>start to end, no explicit step</td></tr>
        <tr><td><code>0..6.28 step 0.1</code></td><td>start to end, step 0.1</td></tr>
      </tbody>
    </table>
    <p>a non-positive step is a semantic error (phase 2).</p>
  </section>

  <section id="expr-block">
    <h2>expr block</h2>
    <p>an <code>expr &#123;...&#125;</code> block defines local bindings that are substituted into a final result expression at compile time. no runtime scope — all bindings are inlined before codegen.</p>
    <pre><code>expr &#123;
  cx = cos(t)
  cy = sin(t)
  (2*cx, cy)
&#125;

// equivalent to writing: (2*cos(t), sin(t))</code></pre>
    <p>the block emits a bare desmos expression — no variable name is bound. useful for parametric curves and complex inline computations that benefit from named intermediate values.</p>

    <h3>rules</h3>
    <ul>
      <li>every line before the last must be <code>name = expr</code></li>
      <li>the final line is the result expression (any expression, including tuples)</li>
      <li>bindings are not visible outside the block</li>
      <li>bindings are substituted in order — later bindings can reference earlier ones</li>
    </ul>
  </section>

  <section id="debug">
    <h2>debug</h2>
    <p><code>debug expr</code> is a compile-time utility. the expression is parsed and type-checked but <strong>no desmos output is emitted</strong>. use it to verify that an expression parses correctly without cluttering the graph.</p>
    <pre><code>fn hyp(x, y) = sqrt(x^2 + y^2)
debug hyp(3, 4)   // compile-time only, emits nothing
debug r           // same — no output</code></pre>
  </section>

  <section id="styling">
    <h2>styling</h2>
    <p>any geometry statement can be followed by <code>as &#123; ... &#125;</code> with space-separated style properties, or by <code>as gradient(from, to)</code>:</p>
    <pre><code>point p2 (0, 0) as &#123; color red pointSize 12 &#125;
circle c = circle((0,0), 3) as &#123; color rgb(0, 128, 255) opacity 0.2 &#125;
region r = y > x^2 as &#123; color "#e040fb" fill &#125;
curve ring (t in 0..6.28) &#123; (cos(t), sin(t)) &#125; as gradient("blue", "red")
pts = (cos(i), sin(i)) for i in 0..6.28 step 0.1 as gradient(rgb(123, 33, 22), "#33dd33")</code></pre>

    <h3>style properties</h3>
    <table>
      <thead><tr><th>property</th><th>value</th><th>applicable to</th></tr></thead>
      <tbody>
        <tr><td><code>color</code></td><td>named, hex string, <code>rgb(r,g,b)</code>, or <code>hsv(h,s,v)</code></td><td>all</td></tr>
        <tr><td><code>gradient(from, to)</code></td><td>two color values (named / hex / rgb / hsv)</td><td>curve, for-comprehension</td></tr>
        <tr><td><code>opacity</code></td><td>number 0–1</td><td>all</td></tr>
        <tr><td><code>fill</code></td><td>(flag, no value)</td><td>region, circle, polygon</td></tr>
        <tr><td><code>pointSize</code></td><td>number</td><td>point</td></tr>
        <tr><td><code>lineStyle</code></td><td><code>solid</code> / <code>dashed</code> / <code>dotted</code></td><td>line, curve, segment</td></tr>
        <tr><td><code>lineWidth</code></td><td>number</td><td>line, curve, segment, spiral, wave, grid</td></tr>
        <tr><td><code>lineOpacity</code></td><td>number 0–1</td><td>curve, segment, spiral, wave, grid</td></tr>
        <tr><td><code>hidden</code></td><td>(flag, no value)</td><td>all</td></tr>
      </tbody>
    </table>

    <h3>named colors</h3>
    <p><code>red</code> <code>blue</code> <code>green</code> <code>orange</code> <code>purple</code> <code>black</code> <code>white</code></p>

    <details class="example-stack">
      <summary>more color formats</summary>
      <div class="example-stack-body">
        <h3>color formats</h3>
        <pre><code>color red              // named color
color "red"            // named color as string
color "#e040fb"        // hex string
color rgb(255, 128, 0) // r g b each 0–255
color hsv(240, 1, 1)   // h 0–360, s/v 0–1</code></pre>
      </div>
    </details>

    <h3>gradients</h3>
    <p>gradients interpolate color along the parameter or loop variable. they can be written as a shorthand suffix or inside a style block:</p>
    <pre><code>curve ring (t in 0..6.28) &#123; (cos(t), sin(t)) &#125; as gradient("blue", "red")
pts = (cos(i), sin(i)) for i in 0..6.28 step 0.1 as gradient(rgb(123, 33, 22), "#33dd33")
curve c (t in 0..4) &#123; (t, sin(t)) &#125; as &#123; gradient("green", "orange") opacity 0.9 &#125;</code></pre>
    <div class="output-tags" aria-label="styling output hints">
      <span class="output-tag">style suffix</span>
      <span class="output-tag">gradient supported</span>
    </div>
  </section>

  <section id="animation">
    <h2>sliders &amp; animation</h2>
    <p>a slider is created with <code>slider(initial, min, max)</code>. all named arguments are optional:</p>
    <pre><code>a = slider(0, 0, 10)                          // static slider
a = slider(3, 0, 10, step=0.1)                // with step
a = slider(3, 0, 10, speed=2)                 // auto-playing at 2× speed
a = slider(3, 0, 10, step=0.1, speed=1, loop) // step + looping auto-play</code></pre>

    <table>
      <thead><tr><th>arg</th><th>type</th><th>description</th></tr></thead>
      <tbody>
        <tr><td>positional 1</td><td>number</td><td>initial value</td></tr>
        <tr><td>positional 2</td><td>number</td><td>minimum</td></tr>
        <tr><td>positional 3</td><td>number</td><td>maximum</td></tr>
        <tr><td><code>step=n</code></td><td>kwarg</td><td>increment per step</td></tr>
        <tr><td><code>speed=n</code></td><td>kwarg</td><td>animation speed (sets <code>animationPeriod = round(1000/n)</code>)</td></tr>
        <tr><td><code>loop</code></td><td>flag</td><td>enables <code>LOOP_FORWARD</code> and <code>isPlaying: true</code></td></tr>
      </tbody>
    </table>
  </section>

  <section id="builtins">
    <h2>built-ins and functions</h2>

    <h3>math functions</h3>
    <table>
      <thead><tr><th>dsl call</th><th>latex output</th></tr></thead>
      <tbody>
        <tr><td><code>sin(x)</code></td><td><code>\sin\left(x\right)</code></td></tr>
        <tr><td><code>cos(x)</code></td><td><code>\cos\left(x\right)</code></td></tr>
        <tr><td><code>tan(x)</code></td><td><code>\tan\left(x\right)</code></td></tr>
        <tr><td><code>arcsin(x)</code></td><td><code>\arcsin\left(x\right)</code></td></tr>
        <tr><td><code>arccos(x)</code></td><td><code>\arccos\left(x\right)</code></td></tr>
        <tr><td><code>arctan(x)</code></td><td><code>\arctan\left(x\right)</code></td></tr>
        <tr><td><code>ln(x)</code></td><td><code>\ln\left(x\right)</code></td></tr>
        <tr><td><code>log(x)</code></td><td><code>\log\left(x\right)</code></td></tr>
        <tr><td><code>min(a, b)</code></td><td><code>\min\left(a,b\right)</code></td></tr>
        <tr><td><code>max(a, b)</code></td><td><code>\max\left(a,b\right)</code></td></tr>
        <tr><td><code>floor(x)</code></td><td><code>\operatorname&#123;floor&#125;\left(x\right)</code></td></tr>
        <tr><td><code>ceil(x)</code></td><td><code>\operatorname&#123;ceil&#125;\left(x\right)</code></td></tr>
        <tr><td><code>round(x)</code></td><td><code>\operatorname&#123;round&#125;\left(x\right)</code></td></tr>
        <tr><td><code>sign(x)</code></td><td><code>\operatorname&#123;sign&#125;\left(x\right)</code></td></tr>
        <tr><td><code>mod(a, b)</code></td><td><code>\operatorname&#123;mod&#125;\left(a,b\right)</code></td></tr>
        <tr><td><code>sqrt(x)</code></td><td><code>\sqrt&#123;x&#125;</code> (radical notation)</td></tr>
        <tr><td><code>abs(x)</code></td><td><code>\left|x\right|</code> (bar notation)</td></tr>
      </tbody>
    </table>

    <h3>compiler-level special calls</h3>
    <table>
      <thead><tr><th>call</th><th>behavior</th></tr></thead>
      <tbody>
        <tr><td><code>slider(init, min, max)</code></td><td>creates a desmos slider expression with the given domain.</td></tr>
        <tr><td><code>time(start, end, speed)</code></td><td>auto-playing slider. <code>animationPeriod = round(1000 / speed)</code>.</td></tr>
        <tr><td><code>rgb(r, g, b)</code></td><td>color value. r/g/b each 0–255.</td></tr>
        <tr><td><code>hsv(h, s, v)</code></td><td>color value. h: 0–360, s/v: 0–1.</td></tr>
        <tr><td><code>gradient(from, to)</code></td><td>style suffix — interpolates color along curve/list parameter. colors can be named, hex strings, rgb(), or hsv().</td></tr>
        <tr><td><code>project(...)</code></td><td>stub — emits the first argument unchanged as latex passthrough.</td></tr>
        <tr><td><code>camera(...)</code></td><td>reserved — passes through the optimizer unmodified.</td></tr>
      </tbody>
    </table>

    <h3>user-defined functions</h3>
    <p>functions declared with <code>fn</code> are inlined at every call site by the optimizer. after optimization, all <code>fn</code> declarations are removed before codegen. recursion is not supported.</p>
    <pre><code>fn dist(a, b) = sqrt(a^2 + b^2)
r = dist(3, 4)   // optimized to: r = 5</code></pre>

    <h3>name-to-latex mapping</h3>
    <table>
      <thead><tr><th>identifier</th><th>latex</th><th>rule</th></tr></thead>
      <tbody>
        <tr><td><code>x</code></td><td><code>x</code></td><td>single letter → unchanged</td></tr>
        <tr><td><code>theta</code></td><td><code>\theta</code></td><td>greek name → latex command</td></tr>
        <tr><td><code>wave</code></td><td><code>w_&#123;ave&#125;</code></td><td>multi-char → first letter + subscript</td></tr>
      </tbody>
    </table>
    <p>recognized greek names:</p>
    <p class="greek-list">
      <code>alpha</code> <code>beta</code> <code>gamma</code> <code>delta</code> <code>epsilon</code>
      <code>zeta</code> <code>eta</code> <code>theta</code> <code>iota</code> <code>kappa</code>
      <code>lambda</code> <code>mu</code> <code>nu</code> <code>xi</code> <code>pi</code>
      <code>rho</code> <code>sigma</code> <code>tau</code> <code>upsilon</code> <code>phi</code>
      <code>chi</code> <code>psi</code> <code>omega</code>
    </p>
  </section>

  <section id="generators">
    <h2>generators</h2>
    <p>built-in generators produce complex shapes from a few parameters. all generators accept optional styling including <code>color</code>, <code>gradient</code>, <code>lineWidth</code>, and <code>lineOpacity</code>.</p>

    <h3>spiral</h3>
    <p>archimedean spiral — radius grows linearly with angle. compiles to a parametric curve.</p>
    <pre><code>spiral s = spiral(turns=5, spacing=0.2)
spiral s = spiral(turns=5, spacing=0.2) as &#123; color purple lineWidth 2 &#125;
// with transforms
spiral s = spiral(turns=8, spacing=0.15, cx=2, cy=1, rotate=0.5) as gradient("blue", "red")</code></pre>
    <table>
      <thead><tr><th>param</th><th>description</th><th>default</th></tr></thead>
      <tbody>
        <tr><td><code>turns</code></td><td>number of full rotations</td><td>required</td></tr>
        <tr><td><code>spacing</code></td><td>radial distance per radian (controls tightness)</td><td>required</td></tr>
        <tr><td><code>cx</code></td><td>x offset of spiral center</td><td><code>0</code></td></tr>
        <tr><td><code>cy</code></td><td>y offset of spiral center</td><td><code>0</code></td></tr>
        <tr><td><code>rotate</code></td><td>rotation offset in radians</td><td><code>0</code></td></tr>
      </tbody>
    </table>

    <h3>wave</h3>
    <p>sine wave rendered as a parametric curve over a configurable x-range.</p>
    <pre><code>wave w = wave(freq=2, amp=1)
wave w = wave(freq=3, amp=0.5, phase=1.57) as &#123; color orange lineWidth 2.5 &#125;
// with domain and offset
wave w = wave(freq=1, amp=2, xmin=-5, xmax=5, cy=3) as gradient("green", "blue")</code></pre>
    <table>
      <thead><tr><th>param</th><th>description</th><th>default</th></tr></thead>
      <tbody>
        <tr><td><code>freq</code></td><td>angular frequency (cycles per 2π units)</td><td>required</td></tr>
        <tr><td><code>amp</code></td><td>amplitude</td><td>required</td></tr>
        <tr><td><code>phase</code></td><td>phase shift in radians</td><td><code>0</code></td></tr>
        <tr><td><code>cx</code></td><td>x offset applied to the wave</td><td><code>0</code></td></tr>
        <tr><td><code>cy</code></td><td>vertical offset</td><td><code>0</code></td></tr>
        <tr><td><code>xmin</code></td><td>left domain bound</td><td><code>-10</code></td></tr>
        <tr><td><code>xmax</code></td><td>right domain bound</td><td><code>10</code></td></tr>
      </tbody>
    </table>

    <h3>grid</h3>
    <p>cartesian grid of horizontal and vertical lines. emits two desmos expressions using list notation.</p>
    <pre><code>grid g = grid(10, 10)
grid g = grid(20, 20) as &#123; color "#888888" opacity 0.3 lineWidth 0.5 &#125;
// custom bounds
grid g = grid(cols=6, rows=6, xmin=-3, xmax=3, ymin=-3, ymax=3)</code></pre>
    <table>
      <thead><tr><th>param</th><th>description</th><th>default</th></tr></thead>
      <tbody>
        <tr><td><code>cols</code></td><td>number of vertical lines (width of grid)</td><td>required</td></tr>
        <tr><td><code>rows</code></td><td>number of horizontal lines (height of grid)</td><td>required</td></tr>
        <tr><td><code>xmin</code></td><td>left bound</td><td><code>-cols/2</code></td></tr>
        <tr><td><code>xmax</code></td><td>right bound</td><td><code>cols/2</code></td></tr>
        <tr><td><code>ymin</code></td><td>bottom bound</td><td><code>-rows/2</code></td></tr>
        <tr><td><code>ymax</code></td><td>top bound</td><td><code>rows/2</code></td></tr>
      </tbody>
    </table>
  </section>

  <section id="codegen">
    <h2>codegen notes</h2>
    <ul>
      <li>output is desmos state version 9 with an expression list.</li>
      <li>default viewport: <code>xmin/ymin = -10</code>, <code>xmax/ymax = 10</code>.</li>
      <li>expression ids are integers starting at 1, incremented per emitted expression.</li>
      <li>identical latex strings are deduplicated — same latex twice returns the same id without a duplicate.</li>
      <li>multiplication uses <code>\cdot</code>; division uses <code>\frac&#123;&#125;&#123;&#125;</code>.</li>
      <li>parentheses are inserted automatically based on operator precedence.</li>
    </ul>

    <h3>expression properties by statement type</h3>
    <table>
      <thead><tr><th>statement</th><th>notable desmos fields</th></tr></thead>
      <tbody>
        <tr><td><code>point</code></td><td><code>showLabel: true</code>, <code>label</code> set to dsl name</td></tr>
        <tr><td><code>circle</code></td><td><code>fill: true</code>, <code>fillOpacity: "0.4"</code></td></tr>
        <tr><td><code>line</code></td><td>bare expression, no extra fields</td></tr>
        <tr><td><code>segment</code></td><td>compiled as a two-vertex polygon</td></tr>
        <tr><td><code>polygon</code></td><td><code>fill: true</code></td></tr>
        <tr><td><code>curve</code> (tuple body)</td><td>parametric with domain bounds</td></tr>
        <tr><td><code>curve</code> (scalar body)</td><td>list comprehension</td></tr>
        <tr><td><code>region</code></td><td>inequality expression, fill determined by styling</td></tr>
        <tr><td><code>text</code></td><td>desmos note with label and position</td></tr>
        <tr><td><code>group</code></td><td>desmos folder expression</td></tr>
        <tr><td><code>slider</code></td><td><code>sliderMin</code>, <code>sliderMax</code>, <code>sliderStep</code> set from args</td></tr>
      </tbody>
    </table>
  </section>

  <section id="optimizer">
    <h2>optimizer notes</h2>
    <p>the optimizer runs after semantic analysis and before codegen. all transformations operate on cloned nodes (shadow-safe — no in-place mutation).</p>
    <ul>
      <li><strong>function inlining</strong> — <code>fn</code> calls are substituted at every call site; <code>FnDecl</code> nodes are removed before codegen.</li>
      <li><strong>expr block inlining</strong> — <code>ExprBlockDecl</code> bindings are substituted into the result expression at compile time; the block emits a bare expression with no name.</li>
      <li><strong>debug stripping</strong> — <code>DebugDecl</code> nodes are removed entirely; no desmos output is emitted.</li>
      <li><strong>constant folding</strong> — all-literal operands are evaluated at compile time.</li>
      <li><strong>algebraic identities</strong>: <code>x+0→x</code>, <code>x*1→x</code>, <code>x*0→0</code>, <code>x^1→x</code>, <code>x^0→1</code>, <code>0/x→0</code>.</li>
      <li><strong>shadow-safe substitution</strong> — loop variables in <code>map</code>/<code>curve</code>/<code>for</code> shadow outer bindings during substitution; inner scope is never polluted.</li>
    </ul>
  </section>

  <section id="errors">
    <h2>errors</h2>
    <p>the compiler reports two distinct error phases. both return as <code>CompileFailure</code> with a <code>phase: 1 | 2</code> field on each error.</p>
    <aside class="callout warning">
      <strong>warning</strong>
      <p>phase 1 stops before semantic analysis. phase 2 means the syntax is valid, but the program still cannot compile cleanly.</p>
    </aside>
    <div class="output-tags" aria-label="error phase hints">
      <span class="output-tag">phase 1</span>
      <span class="output-tag">phase 2</span>
      <span class="output-tag">warnings only</span>
    </div>

    <h3>phase 1 — syntax errors</h3>
    <p>produced by the lexer or parser before any semantic analysis. the program cannot be parsed further.</p>
    <table>
      <thead><tr><th>source</th><th>example</th></tr></thead>
      <tbody>
        <tr><td>lexer</td><td><code>[3:5] Lex error: unexpected character '@'</code></td></tr>
        <tr><td>parser</td><td><code>[7:1] Parse error: expected '=' (got 'foo')</code></td></tr>
      </tbody>
    </table>

    <h3>phase 2 — semantic errors</h3>
    <p>produced after a successful parse, before optimization. the ast is structurally valid but contains logical errors.</p>
    <table>
      <thead><tr><th>check</th><th>example</th></tr></thead>
      <tbody>
        <tr><td>undefined function</td><td><code>[1:5] Semantic error: undefined function 'foo'</code></td></tr>
        <tr><td>arity mismatch</td><td><code>[3:1] Semantic error: 'hyp' expects 2 arguments, got 1</code></td></tr>
        <tr><td>non-positive generator step</td><td><code>[5:20] Semantic error: generator step must be positive</code></td></tr>
      </tbody>
    </table>

    <h3>warnings</h3>
    <p>warnings do not block compilation. they surface in the ide as yellow underlines:</p>
    <ul>
      <li>redeclaring a desmos built-in (<code>t</code>, <code>r</code>, <code>theta</code>)</li>
      <li>duplicate name in the same program</li>
    </ul>
  </section>

  <section id="limitations">
    <h2>current limitations</h2>
    <aside class="callout note">
      <strong>note</strong>
      <p>these are deliberate boundaries, not missing polish. the docs keep them visible so the implementation surface stays honest.</p>
    </aside>
    <ul>
      <li><strong>no implicit multiplication</strong> — write <code>2*x</code>, not <code>2x</code>.</li>
      <li><strong>no bare expressions</strong> — every top-level statement must start with a dsl keyword or an <code>ident =</code> binding.</li>
      <li><strong>no negative step in curve ranges</strong> — <code>t in 10..0</code> is syntactically valid but behavior is undefined.</li>
      <li><strong><code>project</code> and <code>camera</code> are stubs</strong> — reserved keywords with no full implementation.</li>
      <li><strong>no multi-return functions</strong> — <code>fn</code> definitions are single-expression only.</li>
      <li><strong>no recursion</strong> — recursive <code>fn</code> calls produce an infinite loop in the optimizer.</li>
    </ul>
  </section>

  <footer class="footer">
    <p class="footer-kicker">made by jayan patel, 2026</p>
    <p class="footer-line">
      project is open source on <a href="https://github.com/KingJayan/desmos-ide">GitHub</a>
    </p>
    <p class="footer-meta">docs v{pkg.version}, dsl v{dsl.version}</p>
  </footer>
  </main>
{/if}
