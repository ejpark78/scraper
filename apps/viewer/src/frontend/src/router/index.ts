import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import DocumentView from '../views/DocumentView.vue';
import ExporterView from '../views/ExporterView.vue';

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
    path: '/exporter',
    name: 'Exporter',
    component: ExporterView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
