<script>
  import { onMount, onDestroy } from 'svelte';
  import pkg from '../package.json';
  import dsl from '../../package.json';

  const sections = [
    'quick-start', 'lexical-rules', 'top-level', 'expressions',
    'entities', 'points-map', 'animation', 'builtins',
    'codegen', 'optimizer', 'errors', 'limitations',
  ];

  let activeId = '';
  let scrollPct = 0;
  let observers = [];

  onMount(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) activeId = e.target.id;
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach(id => {
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

<div class="progress" style="width: {scrollPct}%"></div>

<main class="page">
  <header class="hero">
    <p class="eyebrow">desmos ide</p>
    <h1>dsl documentation</h1>
    <p class="lede">
      complete reference for the dsl implemented by the compiler in this repository.
      covers syntax, semantics, built-ins, entity schemas, codegen output, and known limitations.
    </p>
  </header>

  <nav class="toc" aria-label="table of contents">
    <a href="#quick-start" class:active={activeId === 'quick-start'}>quick start</a>
    <a href="#lexical-rules" class:active={activeId === 'lexical-rules'}>lexical rules</a>
    <a href="#top-level" class:active={activeId === 'top-level'}>top-level statements</a>
    <a href="#expressions" class:active={activeId === 'expressions'}>expressions</a>
    <a href="#entities" class:active={activeId === 'entities'}>entities</a>
    <a href="#points-map" class:active={activeId === 'points-map'}>points map</a>
    <a href="#animation" class:active={activeId === 'animation'}>animation</a>
    <a href="#builtins" class:active={activeId === 'builtins'}>built-ins</a>
    <a href="#codegen" class:active={activeId === 'codegen'}>codegen</a>
    <a href="#optimizer" class:active={activeId === 'optimizer'}>optimizer</a>
    <a href="#errors" class:active={activeId === 'errors'}>errors</a>
    <a href="#limitations" class:active={activeId === 'limitations'}>limitations</a>
  </nav>

  <section id="quick-start">
    <h2>quick start</h2>
    <pre><code>let a = 3
let b = 4
fn hyp(x, y) = sqrt(x^2 + y^2)

point p &#123;
  center: (1, 2)
&#125;

circle c &#123;
  center: (0, 0),
  radius: hyp(a, b)
&#125;

line l &#123;
  slope: 1,
  intercept: 0
&#125;

points ring = map(i in [0, 0.1...6.28]) &#123;
  (cos(i), sin(i))
&#125;</code></pre>
  </section>

  <section id="lexical-rules">
    <h2>lexical rules</h2>
    <ul>
      <li><strong>comments:</strong> single-line, start with <code>//</code>. everything after <code>//</code> to end-of-line is ignored.</li>
      <li><strong>whitespace:</strong> spaces, tabs, and newlines are ignored except for line and column tracking.</li>
      <li><strong>numbers:</strong> integers and decimals, including leading-dot decimals like <code>.5</code>.</li>
      <li><strong>identifiers:</strong> <code>[A-Za-z_][A-Za-z0-9_]*</code></li>
      <li><strong>keywords:</strong> <code>let</code>, <code>fn</code>, <code>in</code>, <code>map</code>, <code>point</code>, <code>circle</code>, <code>line</code>, <code>points</code>, <code>time</code>, <code>project</code>, <code>camera</code></li>
      <li><strong>range tokens:</strong>
        <ul>
          <li><code>...</code> — list range separator (inside <code>[start...end]</code>)</li>
          <li><code>..</code> — slider domain separator (inside <code>[min..max]</code> on a <code>let</code>)</li>
        </ul>
      </li>
    </ul>
    <h3>comment example</h3>
    <pre><code>let x = 3       // this is a constant
// full-line comment</code></pre>
  </section>

  <section id="top-level">
    <h2>top-level statements</h2>
    <p>only the following statement forms are accepted at program scope:</p>
    <table>
      <thead><tr><th>form</th><th>description</th></tr></thead>
      <tbody>
        <tr><td><code>let name = expr</code></td><td>constant binding (no slider)</td></tr>
        <tr><td><code>let name = expr [min..max]</code></td><td>slider with fixed domain</td></tr>
        <tr><td><code>let name = expr [min..max].play</code></td><td>auto-playing slider (once)</td></tr>
        <tr><td><code>let name = expr [min..max].loop</code></td><td>looping animated slider</td></tr>
        <tr><td><code>fn name(p1, p2, ...) = expr</code></td><td>user-defined function (inlined by optimizer)</td></tr>
        <tr><td><code>point name &#123; ... &#125;</code></td><td>named point entity</td></tr>
        <tr><td><code>circle name &#123; ... &#125;</code></td><td>circle entity</td></tr>
        <tr><td><code>line name &#123; ... &#125;</code></td><td>line entity</td></tr>
        <tr><td><code>points name = map(...) &#123; ... &#125;</code></td><td>parametric point list</td></tr>
      </tbody>
    </table>
    <p>bare expressions at the top level are not valid. every statement must begin with one of the keywords above.</p>
  </section>

  <section id="expressions">
    <h2>expressions</h2>
    <h3>operator precedence (lowest to highest)</h3>
    <ol>
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
        <tr><td>numeric literal</td><td><code>1</code>, <code>3.14</code>, <code>.25</code></td></tr>
        <tr><td>identifier</td><td><code>x</code>, <code>theta</code></td></tr>
        <tr><td>binary op</td><td><code>a + b</code>, <code>a * b</code>, <code>a^b</code></td></tr>
        <tr><td>unary minus</td><td><code>-x</code></td></tr>
        <tr><td>function call</td><td><code>sin(x)</code>, <code>f(a, b)</code></td></tr>
        <tr><td>tuple</td><td><code>(x, y)</code></td></tr>
        <tr><td>list range</td><td><code>[start...end]</code>, <code>[start, step...end]</code></td></tr>
        <tr><td>map expression</td><td><code>map(i in [0...10]) &#123; expr &#125;</code></td></tr>
      </tbody>
    </table>

    <h3>division and power latex output</h3>
    <p>division compiles to a fraction: <code>a / b</code> → <code>\frac&#123;a&#125;&#123;b&#125;</code>. power compiles to a superscript: <code>a^b</code> → <code>a^&#123;b&#125;</code>. parentheses are inserted automatically when precedence requires it.</p>
  </section>

  <section id="entities">
    <h2>entities</h2>
    <p>each entity type gets a distinct default color in the desmos graph.</p>
    <table>
      <thead><tr><th>entity</th><th>default color</th></tr></thead>
      <tbody>
        <tr><td><code>point</code></td><td><span class="swatch" style="background:#2d70b3"></span> <code>#2d70b3</code> (blue)</td></tr>
        <tr><td><code>circle</code></td><td><span class="swatch" style="background:#c74440"></span> <code>#c74440</code> (red)</td></tr>
        <tr><td><code>line</code></td><td><span class="swatch" style="background:#388c46"></span> <code>#388c46</code> (green)</td></tr>
        <tr><td><code>points</code></td><td><span class="swatch" style="background:#6042a6"></span> <code>#6042a6</code> (purple)</td></tr>
      </tbody>
    </table>

    <h3>point</h3>
    <p>a named point rendered with its label shown. two equivalent forms:</p>
    <pre><code>// tuple center
point p &#123;
  center: (2, 3)
&#125;

// scalar coordinates
point p &#123;
  x: 2,
  y: 3
&#125;</code></pre>
    <p>both emit a desmos point expression with <code>showLabel: true</code> and <code>label</code> set to the point name. missing coordinates default to <code>0</code>.</p>

    <h3>circle</h3>
    <pre><code>circle c &#123;
  center: (0, 0),
  radius: 5
&#125;</code></pre>
    <p>compiles to the implicit equation <code>(x-h)²+(y-k)²=r²</code>. fill is enabled with opacity <code>0.1</code>. missing center defaults to <code>(0,0)</code>; missing radius defaults to <code>1</code>.</p>

    <h3>line</h3>
    <p>four supported forms:</p>
    <table>
      <thead><tr><th>properties</th><th>compiled form</th></tr></thead>
      <tbody>
        <tr><td><code>slope</code> + <code>intercept</code></td><td><code>y = mx + b</code></td></tr>
        <tr><td><code>point1</code> + <code>point2</code> (tuples)</td><td>two-point form</td></tr>
        <tr><td><code>y</code></td><td>horizontal: <code>y = k</code></td></tr>
        <tr><td><code>x</code></td><td>vertical: <code>x = h</code></td></tr>
      </tbody>
    </table>
    <pre><code>line axis   &#123; slope: 1, intercept: 0 &#125;
line horiz  &#123; y: 3 &#125;
line vert   &#123; x: -2 &#125;
line seg    &#123; point1: (0, 0), point2: (4, 4) &#125;</code></pre>
    <p>when <code>slope</code> is <code>1</code> the <code>m</code> coefficient is omitted; when <code>intercept</code> is <code>0</code> the <code>b</code> term is omitted.</p>
  </section>

  <section id="points-map">
    <h2>points map</h2>
    <p>the <code>points</code> statement requires a <code>map</code> expression. the loop variable and range are bound locally.</p>
    <pre><code>points wave = map(t in [0, 0.2...20]) &#123;
  (t, sin(t))
&#125;</code></pre>
    <p>compiles to a desmos list comprehension rendered as a point cloud (<code>points: true, lines: false</code>). the step value in <code>[start, step...end]</code> sets the increment between samples.</p>
    <pre><code>// unit circle with 628 samples
points ring = map(i in [0, 0.01...6.28]) &#123;
  (cos(i), sin(i))
&#125;</code></pre>
  </section>

  <section id="animation">
    <h2>sliders and animation</h2>
    <p>a slider is created by appending a domain <code>[min..max]</code> to a <code>let</code> binding. without a domain the variable is a plain constant — no slider is shown.</p>
    <pre><code>let r = 5 [1..20]           // static slider, initial value 5, range [1, 20]
let k = 0.5 [ 0 .. 1 ]     // whitespace inside [..] is flexible
let n = 3                   // plain constant, no slider</code></pre>

    <p>append <code>.play</code> or <code>.loop</code> / <code>.loop(-1)</code> directly after the domain bracket to start animation automatically:</p>
    <pre><code>let t = 0 [0..10].play      // plays once then stops
let a = 0 [-5..5].loop      // loops forward indefinitely
let b = 5 [0..10].loop(-1)  // loops backward</code></pre>
    <table>
      <thead><tr><th>suffix</th><th>desmos loopMode</th><th>isPlaying</th></tr></thead>
      <tbody>
        <tr><td>(none)</td><td>—</td><td>false</td></tr>
        <tr><td><code>.play</code></td><td><code>PLAY_ONCE</code></td><td>true</td></tr>
        <tr><td><code>.loop</code></td><td><code>LOOP_FORWARD</code></td><td>true</td></tr>
        <tr><td><code>.loop(-1)</code></td><td><code>LOOP_BACKWARD</code></td><td>true</td></tr>
      </tbody>
    </table>
    <p>all animated sliders use an <code>animationPeriod</code> of 4000 ms. the initial value is preserved as the slider default (not reset to 0).</p>

    <h3>inline slider overlays</h3>
    <p>the ide renders an interactive mini-slider widget directly over any <code>let</code> line that has a domain. dragging updates the live graph instantly. the widget shows the min and max bounds from the domain bracket.</p>

    <h3>time() call</h3>
    <p>the special <code>time(start, end, speed)</code> call in a <code>let</code> creates an auto-playing slider. the <code>animationPeriod</code> is derived as <code>round(1000 / speed)</code>.</p>
    <pre><code>let t = time(0, 10, 0.5)  // slider 0..10 playing at 0.5 Hz (2000 ms period)</code></pre>
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
        <tr><td><code>time(start, end, speed)</code></td><td>in a <code>let</code> binding, creates an auto-playing slider. <code>animationPeriod = round(1000 / speed)</code>.</td></tr>
        <tr><td><code>project(...)</code></td><td>stub — emits the first argument unchanged as latex passthrough.</td></tr>
        <tr><td><code>camera(...)</code></td><td>reserved keyword; currently passes through the optimizer unmodified.</td></tr>
      </tbody>
    </table>

    <h3>user-defined functions</h3>
    <p>functions declared with <code>fn</code> are aggressively inlined by the optimizer at every call site. after optimization, all <code>FnDecl</code> nodes are removed before codegen.</p>
    <pre><code>fn dist(a, b) = sqrt(a^2 + b^2)
let r = dist(3, 4)   // optimized to: let r = 5</code></pre>

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

    <h3>expression properties by entity type</h3>
    <table>
      <thead><tr><th>entity</th><th>notable desmos fields</th></tr></thead>
      <tbody>
        <tr><td><code>point</code></td><td><code>showLabel: true</code>, <code>label</code> set to dsl name</td></tr>
        <tr><td><code>circle</code></td><td><code>fill: true</code>, <code>fillOpacity: "0.1"</code></td></tr>
        <tr><td><code>line</code></td><td>bare expression, no extra fields</td></tr>
        <tr><td><code>points</code></td><td><code>points: true</code>, <code>lines: false</code></td></tr>
      </tbody>
    </table>
  </section>

  <section id="optimizer">
    <h2>optimizer notes</h2>
    <p>the optimizer runs before codegen and transforms the ast in place.</p>
    <ul>
      <li><strong>function inlining</strong> — user-defined <code>fn</code> calls are substituted at every call site; the <code>FnDecl</code> node is removed afterwards.</li>
      <li><strong>constant folding</strong> — expressions whose operands are all numeric literals are evaluated at compile time.</li>
      <li><strong>algebraic identities</strong>:
        <ul>
          <li><code>x + 0</code> → <code>x</code></li>
          <li><code>x - 0</code> → <code>x</code></li>
          <li><code>x * 1</code> → <code>x</code></li>
          <li><code>x * 0</code> → <code>0</code></li>
          <li><code>x ^ 1</code> → <code>x</code></li>
          <li><code>x ^ 0</code> → <code>1</code></li>
          <li><code>0 / x</code> → <code>0</code></li>
        </ul>
      </li>
      <li><strong>shadow-safe substitution</strong> — when inlining inside a <code>map</code>, avoids substituting the loop variable if it shadows a parameter name.</li>
    </ul>
    <p>optimization is applied recursively until the ast stabilizes (fixed-point).</p>
  </section>

  <section id="errors">
    <h2>errors</h2>
    <p>the compiler reports two error phases. both surface as a <code>CompileFailure</code> return value from <code>compile(src)</code>.</p>
    <table>
      <thead><tr><th>phase</th><th>format</th><th>example</th></tr></thead>
      <tbody>
        <tr><td>lexer</td><td><code>[line:col] Lex error: ...</code></td><td><code>[3:5] Lex error: unexpected character '@'</code></td></tr>
        <tr><td>parser</td><td><code>[line:col] Parse error: ...</code></td><td><code>[7:1] Parse error: expected '&#123;'</code></td></tr>
      </tbody>
    </table>
    <p>in the ide, errors are surfaced as monaco editor markers with precise line and column positioning.</p>
  </section>

  <section id="limitations">
    <h2>current limitations</h2>
    <ul>
      <li><strong>no implicit multiplication</strong> — write <code>2*x</code>, not <code>2x</code>.</li>
      <li><strong>no bare expressions</strong> — every top-level statement must start with a dsl keyword.</li>
      <li><strong>no piecewise syntax</strong> — not yet implemented.</li>
      <li><strong>no general list comprehensions</strong> — list ranges are only valid inside <code>map(...)</code> in a <code>points</code> statement.</li>
      <li><strong>no negative step in ranges</strong> — <code>[10, 9...0]</code> is syntactically valid but behavior is undefined.</li>
      <li><strong><code>project</code> and <code>camera</code> are stubs</strong> — reserved keywords with no full implementation yet.</li>
      <li><strong>no multi-return functions</strong> — <code>fn</code> definitions are single-expression only.</li>
    </ul>
  </section>

  <section id="footer">
    <h2 style="font-size: 1em; color: var(--muted); text-decoration: none;">made by jayan patel, 2026</h2>
    <p style="font-size: 0.9em; color: var(--muted); max-width: none; margin-top: 0.5em;">
      project is open source on <a style="color: var(--muted);" href="https://github.com/KingJayan/desmos-ide">GitHub</a>
    </p>
    <p style="font-size: 0.9em; color: var(--muted); max-width: none; margin-top: 0.5em;">
      docs version { pkg.version }, dsl version { dsl.version }
    </p>
  </section>
</main>

