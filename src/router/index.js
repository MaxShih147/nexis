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
    {
      path: '/user/login',
      name: 'userLogin',
      component: () => import('@/views/user/LoginView.vue'),
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/user/register',
      name: 'userRegister',
      component: () => import('@/views/user/RegisterView.vue'),
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/user/forgot-password',
      name: 'userForgotPassword',
      component: () => import('@/views/user/ForgotPasswordView.vue'),
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/user/email-verification',
      name: 'userEmailVerification',
      component: () => import('@/views/user/EmailVerificationView.vue'),
    },
    {
      path: '/user/oauth/callback',
      name: 'userOAuthCallback',
      component: () => import('@/views/user/OAuthCallbackView.vue'),
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/user',
      component: () => import('@/views/user/UserLayout.vue'),
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: 'account',
          name: 'userAccount',
          component: () => import('@/views/user/AccountView.vue'),
        },
        {
          path: '',
          redirect: '/user/account',
        },
      ],
    },
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
