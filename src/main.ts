import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
// Vuetify 4 注意：`vuetify/styles` 只含核心/工具层（@layer vuetify-components 为空），
// 组件样式须用全量预编译包 `vuetify/dist/vuetify.css`（或 vite-plugin-vuetify 按需注入）。
import "vuetify/dist/vuetify.css";
import "@mdi/font/css/materialdesignicons.css";
import App from "./App.vue";

const vuetify = createVuetify({
    components,
    directives,
    icons: { defaultSet: "mdi" },
    theme: {
        defaultTheme: "light",
        themes: {
            light: {
                dark: false,
                colors: {
                    primary: "#2563eb",
                    secondary: "#64748b",
                    surface: "#ffffff",
                    background: "#f1f5f9",
                    error: "#dc2626",
                    success: "#16a34a",
                    warning: "#d97706",
                    info: "#0ea5e9",
                },
            },
            dark: {
                dark: true,
                colors: {
                    primary: "#60a5fa",
                    secondary: "#94a3b8",
                    surface: "#1e293b",
                    background: "#0f172a",
                    error: "#f87171",
                    success: "#4ade80",
                    warning: "#fbbf24",
                    info: "#38bdf8",
                },
            },
        },
    },
});

createApp(App).use(vuetify).mount("#app");
