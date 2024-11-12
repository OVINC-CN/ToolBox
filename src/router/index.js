import * as vueRouter from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/teo/refresh/',
    name: 'TEORefresh',
    component: () => import('../views/tools/TEORefresh.vue'),
  },
  {
    path: '/uuid/generate/',
    name: 'UUIDGenerate',
    component: () => import('../views/tools/UUIDGenerate.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'Notfound',
    component: () => import('../views/Error404.vue'),
  },
];

const router = vueRouter.createRouter({
  history: vueRouter.createWebHistory(),
  routes,
});

export default router;
