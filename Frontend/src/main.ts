import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './lib/theme'

import vuetify from "./plugins/vuetify";
import "@mdi/font/css/materialdesignicons.css";
import "./style/index.ts";

// Apply persisted theme before mounting the app
initTheme()

const app = createApp(App);

app.use(vuetify);
app.use(router);

app.mount("#app");
