<script>
  import { page } from '$app/stores';
  import Marketplace from '../../Marketplace.svelte';

  $: selected = $page.params.id ?? null;
</script>

<Marketplace {selected} />
<slot />