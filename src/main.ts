import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createPinia } from "pinia";
import App from "./App.vue";

const app = createApp(App);
const vuetify = createVuetify();
const pinia = createPinia();

app.use(vuetify);
app.use(pinia);
app.mount("#app");
