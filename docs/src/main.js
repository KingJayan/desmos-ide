import App from './App.svelte';
import Share from './Share.svelte';
import './styles.css';

const shared = /^\/share\/?$/.test(window.location.pathname);

const app = new (shared ? Share : App)({
  target: document.getElementById('app'),
});

export default app;
