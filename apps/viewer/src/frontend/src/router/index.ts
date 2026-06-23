import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import DocumentView from '../views/DocumentView.vue';
import ExternalView from '../views/ExternalView.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
  },
  {
    path: '/collection/:id',
    name: 'Collection',
    component: DocumentView,
    props: true,
  },
  {
    path: '/external',
    name: 'External',
    component: ExternalView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
