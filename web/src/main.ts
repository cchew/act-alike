import "./style.css";
import { createApp } from "vue";
import App from "./App.vue";

const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
if (umamiWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://umami-indol-one.vercel.app/script.js";
  script.setAttribute("data-website-id", umamiWebsiteId);
  document.head.appendChild(script);
}

createApp(App).mount("#app");
