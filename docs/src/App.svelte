<script>
  import { onMount, onDestroy } from 'svelte';
  import pkg from '../package.json';
  import dsl from '../../package.json';

  const sections = [
    'quick-start', 'lexical-rules', 'top-level', 'expressions',
    'conditionals', 'geometry', 'curves', 'styling',
    'animation', 'builtins', 'codegen', 'optimizer', 'errors', 'limitations',
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
      covers syntax, semantics, built-ins, geometry statements, codegen output, and known limitations.
    </p>
  </header>

  <nav class="toc" aria-label="table of contents">
    <a href="#quick-start"    class:active={activeId === 'quick-start'}>quick start</a>
    <a href="#lexical-rules"  class:active={activeId === 'lexical-rules'}>lexical rules</a>
    <a href="#top-level"      class:active={activeId === 'top-level'}>top-level statements</a>
    <a href="#expressions"    class:active={activeId === 'expressions'}>expressions</a>
    <a href="#conditionals"   class:active={activeId === 'conditionals'}>conditionals</a>
    <a href="#geometry"       class:active={activeId === 'geometry'}>geometry</a>
    <a href="#curves"         class:active={activeId === 'curves'}>curves &amp; regions</a>
    <a href="#styling"        class:active={activeId === 'styling'}>styling</a>
    <a href="#animation"      class:active={activeId === 'animation'}>sliders &amp; animation</a>
    <a href="#builtins"       class:active={activeId === 'builtins'}>built-ins</a>
    <a href="#codegen"        class:active={activeId === 'codegen'}>codegen</a>
    <a href="#optimizer"      class:active={activeId === 'optimizer'}>optimizer</a>
    <a href="#errors"         class:active={activeId === 'errors'}>errors</a>
    <a href="#limitations"    class:active={activeId === 'limitations'}>limitations</a>
  </nav>

  <section id="quick-start">
    <h2>quick start</h2>
    <pre><code>a = slider(0, 0, 10)
fn hyp(x, y) = sqrt(x^2 + y^2)

point p (3, 4)
circle c = circle((0, 0), hyp(3, 4))
line l = slope(1), intercept(0)

curve ring (t in 0..6.28) &#123;
  (cos(t), sin(t))
&#125;

region r = y > x^2</code></pre>
  </section>

  <section id="lexical-rules">
    <h2>lexical rules</h2>
    <ul>
      <li><strong>comments:</strong> single-line, start with <code>//</code>. everything after <code>//</code> to end-of-line is ignored.</li>
      <li><strong>whitespace:</strong> spaces, tabs, and newlines are ignored except for line and column tracking.</li>
      <li><strong>numbers:</strong> integers and decimals. leading-dot decimals like <code>.5</code> are not supported — write <code>0.5</code>.</li>
      <li><strong>identifiers:</strong> <code>[A-Za-z_][A-Za-z0-9_]*</code></li>
      <li><strong>keywords:</strong> <code>fn</code>, <code>in</code>, <code>map</code>, <code>point</code>, <code>circle</code>, <code>line</code>, <code>curve</code>, <code>region</code>, <code>polygon</code>, <code>segment</code>, <code>text</code>, <code>group</code>, <code>as</code>, <code>at</code>, <code>for</code>, <code>step</code>, <code>where</code>, <code>else</code>, <code>time</code>, <code>project</code>, <code>camera</code></li>
      <li><strong>range tokens:</strong>
        <ul>
          <li><code>..</code> — domain separator in curve/for ranges (<code>0..6.28</code>)</li>
          <li><code>-></code> — segment endpoint separator</li>
        </ul>
      </li>
      <li><strong>string literals:</strong> double-quoted, single-line only. used in <code>text</code> and <code>group</code> statements.</li>
    </ul>
    <h3>comment example</h3>
    <pre><code>x = 3       // this is a constant
// full-line comment</code></pre>
  </section>

  <section id="top-level">
    <h2>top-level statements</h2>
    <p>every statement must begin with a keyword or an identifier followed by <code>=</code>. bare expressions are not valid.</p>
    <table>
      <thead><tr><th>form</th><th>description</th></tr></thead>
      <tbody>
        <tr><td><code>name = expr</code></td><td>variable binding</td></tr>
        <tr><td><code>name = slider(init, min, max)</code></td><td>slider with domain</td></tr>
        <tr><td><code>fn name(p1, ...) = expr</code></td><td>user-defined function (inlined by optimizer)</td></tr>
        <tr><td><code>point name (x, y)</code></td><td>named point</td></tr>
        <tr><td><code>circle name = circle((h, k), r)</code></td><td>circle by center and radius</td></tr>
        <tr><td><code>line name = slope(m), intercept(b)</code></td><td>line — slope-intercept form</td></tr>
        <tr><td><code>line name = lhs = rhs</code></td><td>line — standard form</td></tr>
        <tr><td><code>segment name = (x1,y1) -> (x2,y2)</code></td><td>line segment</td></tr>
        <tr><td><code>polygon name = [(x,y), ...]</code></td><td>filled polygon</td></tr>
        <tr><td><code>curve name (v in start..end) &#123; body &#125;</code></td><td>parametric curve or list comprehension</td></tr>
        <tr><td><code>name = body for v in start..end</code></td><td>inline for-comprehension</td></tr>
        <tr><td><code>region name = inequality</code></td><td>filled inequality region</td></tr>
        <tr><td><code>text name = "label" at (x, y)</code></td><td>text label at position</td></tr>
        <tr><td><code>group name as "Folder label"</code></td><td>desmos folder</td></tr>
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
        <tr><td>list literal</td><td><code>[1, 2, 3]</code></td></tr>
        <tr><td>map comprehension</td><td><code>map(i in list) &#123; expr &#125;</code></td></tr>
        <tr><td>conditional (where)</td><td><code>expr where cond else alt</code></td></tr>
        <tr><td>piecewise block</td><td><code>&#123; cond: val, else: val &#125;</code></td></tr>
      </tbody>
    </table>

    <h3>division and power latex output</h3>
    <p>division compiles to a fraction: <code>a / b</code> → <code>\frac&#123;a&#125;&#123;b&#125;</code>. power compiles to a superscript: <code>a^b</code> → <code>a^&#123;b&#125;</code>. parentheses are inserted automatically when precedence requires it.</p>
  </section>

  <section id="conditionals">
    <h2>conditionals</h2>

    <h3>where / else</h3>
    <p>the <code>where</code> form is a two-branch conditional expression:</p>
    <pre><code>v = x^2 where x > 0 else -x^2</code></pre>
    <p>compiles to the desmos piecewise <code>&#123;x>0: x^2, -x^2&#125;</code>.</p>

    <h3>piecewise block</h3>
    <p>multi-branch piecewise with an optional <code>else</code> default:</p>
    <pre><code>z = &#123; x > 0: x^2, x &lt; 0: -x, else: 0 &#125;</code></pre>
    <p>branches are evaluated in order. each <code>cond: val</code> pair maps to a desmos piecewise arm. the <code>else</code> branch is the fallback when no condition matches.</p>
  </section>

  <section id="geometry">
    <h2>geometry</h2>
    <p>all geometry statements support an optional <code>as &#123; ... &#125;</code> styling suffix (see the <a href="#styling">styling</a> section).</p>

    <h3>point</h3>
    <pre><code>point p (1, 2)
point q (a, b)   // dynamic coordinates</code></pre>
    <p>renders a labeled point. coordinates can be any expression. compiles to a desmos expression with <code>showLabel: true</code> and <code>label</code> set to the point name.</p>

    <h3>circle</h3>
    <pre><code>circle c = circle((0, 0), 5)
circle d = circle((a, b), r)</code></pre>
    <p>compiles to the implicit equation <code>(x-h)²+(y-k)²=r²</code> with fill enabled at opacity <code>0.4</code>.</p>

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

  <section id="styling">
    <h2>styling</h2>
    <p>any geometry statement can be followed by <code>as &#123; ... &#125;</code> with space-separated style properties:</p>
    <pre><code>point p2 (0, 0) as &#123; color red pointSize 12 &#125;
circle c = circle((0,0), 3) as &#123; color rgb(0, 128, 255) opacity 0.2 &#125;
region r = y > x^2 as &#123; color green fill &#125;</code></pre>

    <h3>style properties</h3>
    <table>
      <thead><tr><th>property</th><th>value</th><th>applicable to</th></tr></thead>
      <tbody>
        <tr><td><code>color</code></td><td>named color or <code>rgb(r,g,b)</code> / <code>hsv(h,s,v)</code></td><td>all</td></tr>
        <tr><td><code>opacity</code></td><td>number 0–1</td><td>all</td></tr>
        <tr><td><code>fill</code></td><td>(flag, no value)</td><td>region, circle, polygon</td></tr>
        <tr><td><code>pointSize</code></td><td>number</td><td>point</td></tr>
        <tr><td><code>lineStyle</code></td><td><code>solid</code> / <code>dashed</code> / <code>dotted</code></td><td>line, curve, segment</td></tr>
        <tr><td><code>lineWidth</code></td><td>number</td><td>line, curve, segment</td></tr>
        <tr><td><code>hidden</code></td><td>(flag, no value)</td><td>all</td></tr>
      </tbody>
    </table>

    <h3>named colors</h3>
    <p><code>red</code> <code>blue</code> <code>green</code> <code>orange</code> <code>purple</code> <code>black</code> <code>white</code></p>

    <h3>color functions</h3>
    <pre><code>color rgb(255, 128, 0)   // r g b each 0–255
color hsv(240, 1, 1)     // h 0–360, s/v 0–1</code></pre>
  </section>

  <section id="animation">
    <h2>sliders &amp; animation</h2>
    <p>a slider is created with the <code>slider(initial, min, max)</code> call. the initial value, min, and max can be any numeric expression.</p>
    <pre><code>a = slider(0, 0, 10)     // slider, initial 0, range [0, 10]
r = slider(5, 1, 20)     // slider, initial 5, range [1, 20]
x = 3                    // plain constant, no slider</code></pre>

    <p>add an optional <code>speed=n</code> keyword argument to auto-play the slider at a given rate:</p>
    <pre><code>t = slider(0, 0, 10, speed=2)   // auto-playing, 2× speed</code></pre>

    <h3>time() call</h3>
    <p>the special <code>time(start, end, speed)</code> call creates an auto-playing slider. the <code>animationPeriod</code> is derived as <code>round(1000 / speed)</code>.</p>
    <pre><code>t = time(0, 10, 0.5)   // slider 0..10 playing at 0.5 Hz (2000 ms period)</code></pre>
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
        <tr><td><code>rgb(r, g, b)</code></td><td>desmos color value. r/g/b each 0–255.</td></tr>
        <tr><td><code>hsv(h, s, v)</code></td><td>desmos color value. h: 0–360, s/v: 0–1.</td></tr>
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
      <li><strong>shadow-safe substitution</strong> — when inlining inside a <code>curve</code> or <code>map</code>, avoids substituting the loop variable if it shadows a parameter name.</li>
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
        <tr><td>parser</td><td><code>[line:col] Parse error: ...</code></td><td><code>[7:1] Parse error: expected '='</code></td></tr>
      </tbody>
    </table>
    <p>in the ide, errors are surfaced as monaco editor markers with precise line and column positioning. warnings (duplicate names, reserved name collisions) are shown as yellow underlines.</p>
  </section>

  <section id="limitations">
    <h2>current limitations</h2>
    <ul>
      <li><strong>no implicit multiplication</strong> — write <code>2*x</code>, not <code>2x</code>.</li>
      <li><strong>no bare expressions</strong> — every top-level statement must start with a dsl keyword or an <code>ident =</code> binding.</li>
      <li><strong>no negative step in curve ranges</strong> — <code>t in 10..0</code> is syntactically valid but behavior is undefined.</li>
      <li><strong><code>project</code> and <code>camera</code> are stubs</strong> — reserved keywords with no full implementation.</li>
      <li><strong>no multi-return functions</strong> — <code>fn</code> definitions are single-expression only.</li>
      <li><strong>no recursion</strong> — recursive <code>fn</code> calls produce an infinite loop in the optimizer.</li>
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
