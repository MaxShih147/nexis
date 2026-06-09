import { useAuthStore } from '@/stores/useAuthStore'
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

export function authNavigationGuard(to) {
  const authStore = useAuthStore()
  authStore.syncFromStorage()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      path: '/user/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated)
    return '/user/dashboard'
}

router.beforeEach(authNavigationGuard)

export default router
