<script>
  import { onMount, onDestroy } from 'svelte';
  import { highlightSnippets } from './highlight.js';
  import Icon from '@iconify/svelte';
  import Nav from './Nav.svelte';
  import pkg from '../package.json';
  import dsl from '../../package.json';

  export let route = 'home';

  $: routeTitle = route === 'docs'
    ? 'docs | desmos dsl'
    : route === 'download'
      ? 'downloads | desmos ide'
      : 'desmos ide';

  $: routeDescription = route === 'docs'
    ? 'Reference for the dsmx DSL.'
    : route === 'download'
      ? 'Install dsmx or build the desktop app from source.'
      : 'Code your Desmos graphs.';

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
    { id: 'generators', label: 'spiral, wave, grid' },
    { id: 'expr-block', label: 'expr block' },
    { id: 'debug', label: 'debug' },
    { id: 'styling', label: 'styling' },
    { id: 'animation', label: 'sliders & the clock' },
    { id: 'three-d', label: '3d projection' },
    { id: 'builtins', label: 'built-ins' },
    { id: 'codegen', label: 'codegen' },
    { id: 'optimizer', label: 'optimizer' },
    { id: 'plugins', label: 'plugins' },
    { id: 'errors', label: 'errors' },
    { id: 'limitations', label: 'limitations' },
  ];

  const summaryCards = [
    {
      title: 'start here',
      kicker: 'basics',
      copy: 'syntax, statement forms, short examples',
      links: [
        { id: 'quick-start', label: 'quick start' },
        { id: 'lexical-rules', label: 'lexical rules' },
        { id: 'top-level', label: 'top-level statements' },
      ],
    },
    {
      title: 'language core',
      kicker: 'syntax',
      copy: 'expressions, conditionals, domains, expr blocks, debug',
      links: [
        { id: 'expressions', label: 'expressions' },
        { id: 'conditionals', label: 'conditionals' },
        { id: 'domain', label: 'domain restriction' },
        { id: 'expr-block', label: 'expr block' },
      ],
    },
    {
      title: 'drawing',
      kicker: 'geometry',
      copy: 'styling suffixes for point, line, region, curve, and gen stmts',
      links: [
        { id: 'geometry', label: 'geometry' },
        { id: 'curves', label: 'curves & regions' },
        { id: 'generators-map', label: 'map generator' },
        { id: 'generators', label: 'spiral, wave, grid' },
        { id: 'styling', label: 'styling' },
      ],
    },
    {
      title: 'motion',
      kicker: 'animation',
      copy: 'sliders, clock, 3d proj',
      links: [
        { id: 'animation', label: 'sliders & the clock' },
        { id: 'three-d', label: '3d projection' },
      ],
    },
    {
      title: 'compiler surface',
      kicker: 'runtime',
      copy: 'builtins, code gen, optimizer behavior, error phases, everything else',
      links: [
        { id: 'builtins', label: 'built-ins' },
        { id: 'codegen', label: 'codegen' },
        { id: 'optimizer', label: 'optimizer' },
        { id: 'plugins', label: 'plugins' },
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

<Nav {route} />

{#if route === 'home'}
  <main class="landing">
    <section class="landing-stage">
      <h1>desmos ide</h1>
      <p class="landing-tagline">code your desmos graphs.</p>
      <div class="home-actions">
        <a class="cta" href="/docs"><Icon icon="lucide:book-open" />&emsp;read the docs</a>
        <a class="cta" href="/download"><Icon icon="lucide:download" />&emsp;downloads</a>
      </div>
    </section>

    <div class="install-strip">
      <span>install dsmx: </span>
      <code><Icon icon="lucide:terminal" />&nbsp;brew install KingJayan/dsmx/dsmx</code>
      <a href="/download" style="text-decoration:underline">other ways</a>
    </div>
  </main>
{:else if route === 'download'}
  <main class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">downloads</p>
        <h1>install</h1>
        <p class="lede">
          terminal or desktop ide
        </p>
      </div>
      <div class="hero-meta" aria-label="release metadata">
        <span class="meta-chip">v{dsl.version}</span>
        <a class="meta-chip" href="https://github.com/KingJayan/desmos-ide/releases">
          <Icon icon="lucide:tag" />release notes
        </a>
      </div>
    </header>

    <section id="cli">
      <h2><Icon icon="lucide:terminal" />dsmx cli</h2>
      <p>through Homebrew (macOS + Linux):</p>
      <pre class="no-highlight"><code>brew install KingJayan/dsmx/dsmx</code></pre>
      <p>then:</p>
      <pre class="no-highlight"><code>dsmx run graph.dsmx      # open it in the browser, and redraw on every save
dsmx build graph.dsmx    # write the desmos state as json
dsmx fmt graph.dsmx      # format in place</code></pre>
      <p>
        <code>run</code> loads desmos api, requires an internet connection. <code>build</code> and <code>fmt</code> do not. the formula also installs the
        example files, viewable with <code>brew --prefix dsmx</code>.
      </p>
    </section>

    <section id="desktop">
      <h2><Icon icon="lucide:monitor" />desktop editor</h2>
      <p>
        pairs a monaco buffer and a live desmos graph with two-way sync. includes git + ai integration.
      </p>
      <pre class="no-highlight"><code>brew install --cask KingJayan/dsmx/dsmx-app</code></pre>
      <p>
        macOS only for now (uses system webview). the build carries an ad-hoc signature, not a
        Developer ID one, so the cask clears the quarantine flag after it copies the app. a manual
        download from the releases page keeps that flag and macOS refuses to open it.
      </p>
      <p>from source instead:</p>
      <pre class="no-highlight"><code>git clone https://github.com/KingJayan/desmos-ide
cd desmos-ide
bun install
bun run dev</code></pre>
    </section>

    <footer class="footer">
      <p class="footer-line">
        project is open source on
        &nbsp;<a class="icon-link" href="https://github.com/KingJayan/desmos-ide"><Icon icon="simple-icons:github" />GitHub</a>.
      </p>
    </footer>
  </main>
{:else}
  <div class="progress" style="width: {scrollPct}%"></div>

  <main class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">desmos ide</p>
        <h1>dsl documentation</h1>
        <p class="lede">
          all statements the dsl takes + their compiled latex.
        </p>
      </div>
      <div class="hero-meta" aria-label="documentation metadata">
        <span class="meta-chip">docs v{pkg.version}</span>
        <span class="meta-chip">dsl v{dsl.version}</span>
        <a class="meta-chip icon-chip" href="/" aria-label="landing page" title="landing page">
          <Icon icon="lucide:house" />
        </a>
      </div>
    </header>

    <div class="docs-body">
    <aside class="toc-rail">
      <nav class="toc" aria-label="table of contents">
        <p class="toc-head">on this page</p>
        {#each navItems as item}
          <a href={`#${item.id}`} class:active={activeId === item.id}>{item.label}</a>
        {/each}
      </nav>
    </aside>

    <div class="docs-content">
    <section class="overview" aria-label="sections">
      <div class="overview-copy">
        <h2>sections</h2>
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
          <br>
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
      <li><strong>statements:</strong> one per line. a newline ends a statement, unless it falls inside <code>()</code>, <code>[]</code> or <code>&#123;&#125;</code>, or right after a token that still needs a right-hand side — so blocks, piecewise and trailing operators can span lines.</li>
      <li><strong>numbers:</strong> integers, decimals and scientific notation (<code>1e5</code>). write <code>0.5</code>, not <code>.5</code>.</li>
      <li><strong>identifiers:</strong> <code>[A-Za-z_][A-Za-z0-9_]*</code>. greek letters are identifier characters and normalise to their ascii names, so <code>α</code> and <code>alpha</code> are one variable.</li>
      <li><strong>implicit multiplication:</strong> adjacent factors multiply, as they do in desmos — <code>2x</code>, <code>3sin(t)</code>, <code>2(x+1)</code>. the factors must touch: a space is what keeps <code>expr &#123; &#125;</code> bindings apart.</li>
      <li><strong>keywords:</strong> <code>fn</code> <code>alias</code> <code>debug</code> <code>in</code> <code>map</code> <code>point</code> <code>circle</code> <code>line</code> <code>curve</code> <code>region</code> <code>polygon</code> <code>segment</code> <code>text</code> <code>group</code> <code>as</code> <code>at</code> <code>for</code> <code>step</code> <code>where</code> <code>else</code> <code>if</code> <code>then</code> <code>domain</code> <code>expr</code> <code>loop</code> <code>time</code> <code>period</code> <code>mirror</code> <code>project</code> <code>camera</code> <code>azimuth</code> <code>elevation</code> <code>spiral</code> <code>wave</code> <code>grid</code></li>
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
        <tr><td><code>time name = a..b period ms</code></td><td>the clock — one auto-playing slider, see <a href="#animation">animation</a></td></tr>
        <tr><td><code>camera name = azimuth(a), elevation(e)</code></td><td>the view angles <code>project()</code> reads</td></tr>
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
      <p>all three forms lower to the same piecewise output. pick whichever reads best.</p>
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
      <p>this filters what gets drawn. the expression itself does not change.</p>
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
    <p>the range <code>start..end</code> is passed directly to desmos as the parametric domain. add <code>step n</code> to sample it instead:</p>
    <pre><code>curve ring (t in 0..6.28 step 0.01) &#123; (cos(t), sin(t)) &#125;</code></pre>

    <h3>inline for-comprehension</h3>
    <p>shorter than the block <code>curve</code>:</p>
    <pre><code>pts = (cos(t), sin(t)) for t in 0..6.28</code></pre>
    <p>same meaning as the block form, and the same compiled output.</p>

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
    <p>the block emits a bare desmos expression, with no variable name bound. use it when a long parametric body reads better with named intermediates.</p>

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
        <tr><td><code>lineWidth</code></td><td>number</td><td>line, curve, segment, spiral, wave, grid</td></tr>
        <tr><td><code>lineOpacity</code></td><td>number 0–1</td><td>curve, segment, spiral, wave, grid</td></tr>
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
        <tr><td>positional 4</td><td>number</td><td>speed, the same as <code>speed=</code></td></tr>
        <tr><td><code>step=n</code></td><td>kwarg</td><td>increment per step</td></tr>
        <tr><td><code>speed=n</code></td><td>kwarg</td><td>animation speed (sets <code>animationPeriod = round(1000/n)</code>)</td></tr>
        <tr><td><code>loop</code></td><td>flag</td><td>enables <code>LOOP_FORWARD</code> and <code>isPlaying: true</code></td></tr>
      </tbody>
    </table>

    <h3>the clock</h3>
    <p>
      <code>time</code> declares one auto-playing slider that everything else can read. a file may hold
      at most one, and the ide draws it as the timeline bar under the graph.
    </p>
    <pre><code>time T = 0..6.28 period 14000        // one sweep every 14 seconds
time T                              // 0..1, period 4000, looping
time T = 0..1 period 2000 mirror    // runs forward, then back</code></pre>
    <table>
      <thead><tr><th>part</th><th>meaning</th><th>default</th></tr></thead>
      <tbody>
        <tr><td><code>= a..b</code></td><td>the range it sweeps</td><td><code>0..1</code></td></tr>
        <tr><td><code>period ms</code></td><td>milliseconds for one sweep</td><td><code>4000</code></td></tr>
        <tr><td><code>loop</code> / <code>mirror</code></td><td><code>LOOP_FORWARD</code> / <code>LOOP_FORWARD_REVERSE</code></td><td><code>loop</code></td></tr>
      </tbody>
    </table>
    <p>read the clock anywhere a number goes — a body drawn at <code>T</code> instead of at <code>t</code> moves:</p>
    <pre><code>time T = 0..6.28 period 12000

curve path (t in 0..6.28) &#123; (2cos(t), 2sin(t)) &#125;
point body (2cos(T), 2sin(T)) as &#123; color blue pointSize 12 &#125;</code></pre>
    <div class="output-tags" aria-label="clock output hints">
      <span class="output-tag">one per file</span>
      <span class="output-tag">plain desmos slider</span>
    </div>
  </section>

  <section id="three-d">
    <h2>3d projection</h2>
    <p>
      <code>camera</code> fixes two view angles, and <code>project(x, y, z)</code> flattens a 3d point
      through them onto the 2d graph. the projection is done in latex at compile time, so the result is
      an ordinary desmos point — anything that takes a point takes a projected one.
    </p>
    <pre><code>camera cam = azimuth(0.6), elevation(0.4)

time T = 0..6.28 period 10000

// a coil that climbs as it turns
coil = project(2cos(u), 2sin(u), u/6) for u in 0..12.57 step 0.02

// the same expression read at the clock, so it rides the coil
tip = project(2cos(T), 2sin(T), T/6)</code></pre>
    <p>
      <code>project</code> returns a point, so it goes where a point goes — a <code>for</code> body, a
      binding, a curve. it is not accepted where the grammar wants a literal tuple, so
      <code>point p project(...)</code> is a parse error; bind it instead.
    </p>
    <p>
      a camera declaration emits two plain variables, <code>cam_az</code> and <code>cam_el</code>, so the
      angles stay draggable in desmos. one camera per file; without one the projection uses azimuth 0.6 and elevation 0.4.
    </p>
    <aside class="callout note">
      <strong>note</strong>
      <p>this is a projection, not a 3d renderer. faces draw in source order, with no depth sorting and no hidden-surface removal.</p>
    </aside>
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
        <tr><td><code>exp(x)</code></td><td><code>\exp\left(x\right)</code></td></tr>
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
        <tr><td><code>rgb(r, g, b)</code></td><td>color value. r/g/b each 0–255.</td></tr>
        <tr><td><code>hsv(h, s, v)</code></td><td>color value. h: 0–360, s/v: 0–1.</td></tr>
        <tr><td><code>gradient(from, to)</code></td><td>style suffix only — interpolates color along the curve or list parameter. colors can be named, hex strings, rgb(), or hsv().</td></tr>
        <tr><td><code>project(x, y, z)</code></td><td>projects a 3d point onto the graph through the declared camera. <code>z</code> defaults to 0.</td></tr>
      </tbody>
    </table>

    <h3>animation presets</h3>
    <p>each preset takes a sweep value <code>u</code> and lowers to plain latex — no runtime helper is emitted. feed them the clock.</p>
    <table>
      <thead><tr><th>call</th><th>shape</th><th>latex</th></tr></thead>
      <tbody>
        <tr><td><code>ease(u)</code></td><td>smoothstep — starts and ends at rest</td><td><code>u^&#123;2&#125;(3-2u)</code></td></tr>
        <tr><td><code>pulse(u)</code></td><td>rises 0 → 1 → 0</td><td><code>1-\left|2u-1\right|</code></td></tr>
        <tr><td><code>bounce(u)</code></td><td>a bounce off zero, eased at the top</td><td><code>\left|\sin(\pi u)\right|</code></td></tr>
        <tr><td><code>wobble(u, amp)</code></td><td>one full sine cycle. amp defaults to 1</td><td><code>amp\sin(2\pi u)</code></td></tr>
        <tr><td><code>orbit(u, r)</code></td><td>a point once around a circle. r defaults to 1</td><td><code>(r\cos(2\pi u), r\sin(2\pi u))</code></td></tr>
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
    <p>generators build a shape from a few parameters. all of them take styling: <code>color</code>, <code>gradient</code>, <code>lineWidth</code>, <code>lineOpacity</code>.</p>

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
        <tr><td><code>circle</code></td><td><code>fill: true</code>, <code>fillOpacity: "0.1"</code> unless <code>opacity</code> is styled</td></tr>
        <tr><td><code>line</code></td><td>bare expression, no extra fields</td></tr>
        <tr><td><code>segment</code></td><td>compiled as a two-vertex polygon</td></tr>
        <tr><td><code>polygon</code></td><td><code>fill: true</code>, <code>fillOpacity: "0.2"</code></td></tr>
        <tr><td><code>time</code></td><td>slider with <code>isPlaying</code>, <code>animationPeriod</code>, <code>loopMode</code></td></tr>
        <tr><td><code>camera</code></td><td>two plain variables, <code>name_az</code> and <code>name_el</code></td></tr>
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
    <p>every transform is recorded, so <code>CompileSuccess.optimizations</code> lists each fold, identity, inline and drop with the position it happened at. the app shows that list in the optimizer tool window (<code>⌘6</code>) and prints the outermost result after the line it belongs to.</p>
  </section>

  <section id="plugins">
    <h2>plugins</h2>
    <p>a plugin adds to the language and to the editor without changing either. it is a manifest plus up to three parts, all optional: <code>lib.dsmx</code>, whose <code>fn</code> declarations reach every compile as a prelude; <code>main.js</code>, which runs in a worker with no network, no storage and no DOM; and a declarative theme.</p>
    <p>plugins are client-side. a share link carries the file, never the plugin, so anything you send has to compile without it.</p>
    <ul>
      <li><strong>generators</strong> — <code>main.js</code> registers a macro, and <code>@name(1, "two")</code> on a line of its own expands into DSL before the compiler runs. the expansion keeps a line map, so an error inside generated code is reported against the line you wrote.</li>
      <li><strong>libraries</strong> — <code>lib.dsmx</code> may declare only <code>fn</code> and <code>alias</code>. the declarations are inlined at their call sites and never drawn, so a plugin cannot put anything on your graph.</li>
      <li><strong>pinning</strong> — <code>use "polar-lab"</code> names a plugin the file needs. without it the file fails to compile instead of quietly drawing nothing.</li>
      <li><strong>commands</strong> — palette entries that hand back text to insert or replace. commands can have keybindings and show up in the right-click menu.</li>
      <li><strong>panels</strong> — a plugin sends widgets as data and the app builds them, so its markup never reaches the page. state can be kept per plugin or per folder.</li>
    </ul>
    <p>a macro that runs longer than a second and a half is stopped and its plugin reloaded, because a worker cannot be interrupted any other way. browse what exists on the <a href="/marketplace">marketplace</a>, or in the app with <code>⌘7</code>. the registry has the api reference and six examples.</p>
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
        <tr><td>undefined variable</td><td><code>[2:9] Semantic error: undefined variable 'raduis'</code></td></tr>
        <tr><td>undefined function</td><td><code>[1:5] Semantic error: undefined function 'foo'</code></td></tr>
        <tr><td>arity mismatch</td><td><code>[3:1] Semantic error: 'hyp' expects 2 argument(s), got 1</code></td></tr>
        <tr><td>non-positive generator step</td><td><code>[5:20] Semantic error: generator step must be positive</code></td></tr>
        <tr><td>second clock or camera</td><td><code>Only one 'time' declaration is allowed</code></td></tr>
      </tbody>
    </table>
    <p>
      every identifier must be declared by some statement, so a typo is a compile error and not a new
      silent desmos variable. <code>x</code>, <code>y</code>, <code>t</code>, <code>r</code>,
      <code>theta</code>, <code>e</code> and <code>pi</code> are the exceptions — desmos gives those
      a meaning already.
    </p>

    <h3>warnings</h3>
    <p>warnings do not block compilation. they surface in the ide as yellow underlines:</p>
    <ul>
      <li>redeclaring a desmos built-in (<code>t</code>, <code>r</code>, <code>theta</code>)</li>
      <li>duplicate name in the same program</li>
      <li>an <code>alias</code> or <code>fn</code> that nothing uses</li>
    </ul>
  </section>

  <section id="limitations">
    <h2>current limitations</h2>
    <ul>
      <li><strong>no bare expressions</strong> — every top-level statement must start with a dsl keyword or an <code>ident =</code> binding. <code>expr &#123;...&#125;</code> is the one exception.</li>
      <li><strong>no negative step in curve ranges</strong> — <code>t in 10..0</code> is syntactically valid but behavior is undefined.</li>
      <li><strong>one clock, one camera</strong> — a second <code>time</code> or <code>camera</code> declaration is a semantic error.</li>
      <li><strong>3d is a projection, not a renderer</strong> — <code>project</code> flattens a point onto the 2d graph. there is no depth sorting and no hidden-surface removal.</li>
      <li><strong>no multi-return functions</strong> — <code>fn</code> definitions are single-expression only.</li>
      <li><strong>no recursion</strong> — recursive <code>fn</code> calls produce an infinite loop in the optimizer.</li>
    </ul>
  </section>

  <footer class="footer">
    <p class="footer-kicker">made by jayan patel, 2026</p>
    <p class="footer-line">
      project is open source on
      <a class="icon-link" href="https://github.com/KingJayan/desmos-ide"><Icon icon="simple-icons:github" />GitHub</a>
    </p>
    <p class="footer-meta">docs v{pkg.version}, dsl v{dsl.version}</p>
  </footer>
    </div>
    </div>
  </main>
{/if}
