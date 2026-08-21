<script>
  import Icon from '@iconify/svelte';

  export let route = 'home';
</script>

<nav class="topbar" aria-label="site">
  <a class="topbar-mark" href="/">
    <svg class="topbar-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12h19" opacity="0.4" />
      <path d="M12 2.5v19" opacity="0.4" />
      <path d="M3 6 Q12 17.5 21 6" />
    </svg>
    dsmx
  </a>
  <a href="/docs" class:current={route === 'docs'}><Icon icon="lucide:book-open" />docs</a>
  <a href="/marketplace" class:current={route === 'marketplace'}><Icon icon="lucide:puzzle" />plugins</a>
  <a href="/download" class:current={route === 'download'}><Icon icon="lucide:download" />downloads</a>
  <a class="topbar-out" href="https://github.com/KingJayan/desmos-ide">
    <Icon icon="simple-icons:github" />github
  </a>
</nav>
