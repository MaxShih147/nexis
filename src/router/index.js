import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    // Auth/account routes intentionally removed — nexis is a no-backend SPA.
    // Any /user/* (or other) URL falls through to the catch-all and redirects home.
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      redirect: '/',
    },
  ],
})

export default router
