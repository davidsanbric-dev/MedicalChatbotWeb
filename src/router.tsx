import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/app-shell';
import { NotFoundPage } from '@/pages/not-found-page';

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: NotFoundPage });
const getParentRoute = () => rootRoute;

// Each page is its own chunk; the 3D scene and data pages load on demand.
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute, path: '/', component: lazyRouteComponent(() => import('@/pages/home-page'), 'HomePage') }),
  createRoute({ getParentRoute, path: '/scraper', component: lazyRouteComponent(() => import('@/pages/scraper-page'), 'ScraperPage') }),
  createRoute({ getParentRoute, path: '/worker', component: lazyRouteComponent(() => import('@/pages/worker-page'), 'WorkerPage') }),
  createRoute({ getParentRoute, path: '/database', component: lazyRouteComponent(() => import('@/pages/database-page'), 'DatabasePage') }),
  createRoute({ getParentRoute, path: '/api', component: lazyRouteComponent(() => import('@/pages/api-page'), 'ApiPage') }),
  createRoute({ getParentRoute, path: '/interface', component: lazyRouteComponent(() => import('@/pages/interface-page'), 'InterfacePage') }),
  createRoute({ getParentRoute, path: '/chat', component: lazyRouteComponent(() => import('@/pages/chat-page'), 'ChatPage') }),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
