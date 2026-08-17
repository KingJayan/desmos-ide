import App from './App.svelte';
import Share from './Share.svelte';
import Marketplace from './Marketplace.svelte';
import './styles.css';

const path = window.location.pathname;

function page() {
  if (/^\/share\/?$/.test(path)) return Share;
  if (/^\/marketplace(\/[a-z0-9-]+)?\/?$/.test(path)) return Marketplace;
  return App;
}

const app = new (page())({
  target: document.getElementById('app'),
});

export default app;
