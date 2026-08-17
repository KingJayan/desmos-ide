<script>
  import Icon from '@iconify/svelte';

  export let route = 'home';
</script>

<nav class="topbar" aria-label="site">
  <a class="topbar-mark" href="/">dsmx</a>
  <a href="/docs" class:current={route === 'docs'}><Icon icon="lucide:book-open" />docs</a>
  <a href="/download" class:current={route === 'download'}><Icon icon="lucide:download" />downloads</a>
  <a class="topbar-out" href="https://github.com/KingJayan/desmos-ide">
    <Icon icon="simple-icons:github" />github
  </a>
</nav>
